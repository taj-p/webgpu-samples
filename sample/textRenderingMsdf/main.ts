import { mat4, vec3 } from 'wgpu-matrix';

import { cubeVertexArray } from '../../meshes/cube';
import { MsdfTextRenderer } from './msdfText';

import { quitIfWebGPUNotAvailable } from '../util';

const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const adapter = await navigator.gpu?.requestAdapter();
const device = await adapter?.requestDevice();
quitIfWebGPUNotAvailable(adapter, device);

const context = canvas.getContext('webgpu') as GPUCanvasContext;

const devicePixelRatio = window.devicePixelRatio || 1;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
const depthFormat = 'depth24plus';

context.configure({
  device,
  format: presentationFormat,
});

const textRenderer = new MsdfTextRenderer(
  device,
  presentationFormat,
  depthFormat
);
const font = await textRenderer.createFont(
  new URL('../../assets/font/Corben-Regular.json', import.meta.url).toString()
);

function getTextTransform(
  position: [number, number, number],
  rotation?: [number, number, number]
) {
  const textTransform = mat4.create();
  mat4.identity(textTransform);
  mat4.translate(textTransform, position, textTransform);
  if (rotation && rotation[0] != 0) {
    mat4.rotateX(textTransform, rotation[0], textTransform);
  }
  if (rotation && rotation[1] != 0) {
    mat4.rotateY(textTransform, rotation[1], textTransform);
  }
  if (rotation && rotation[2] != 0) {
    mat4.rotateZ(textTransform, rotation[2], textTransform);
  }
  return textTransform;
}

const textTransforms = [
  // getTextTransform([0, 0, 1.1]),
  // getTextTransform([0, 0, -1.1], [0, Math.PI, 0]),
  // getTextTransform([1.1, 0, 0], [0, Math.PI / 2, 0]),
  // getTextTransform([-1.1, 0, 0], [0, -Math.PI / 2, 0]),
  getTextTransform([0, 0, 0]),
  // getTextTransform([0, -1.1, 0], [Math.PI / 2, 0, 0]),
];

const titleText = textRenderer.formatText(font, `a`, {
  centered: true,
  pixelScale: 1 / 128,
});

const text = [titleText];

// Create a vertex buffer from the cube data.
const verticesBuffer = device.createBuffer({
  size: cubeVertexArray.byteLength,
  usage: GPUBufferUsage.VERTEX,
  mappedAtCreation: true,
});
new Float32Array(verticesBuffer.getMappedRange()).set(cubeVertexArray);
verticesBuffer.unmap();

const depthTexture = device.createTexture({
  size: [canvas.width, canvas.height],
  format: depthFormat,
  usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

const uniformBufferSize = 4 * 16; // 4x4 matrix
const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: undefined, // Assigned later

      clearValue: [0, 0, 0, 1],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
  depthStencilAttachment: {
    view: depthTexture.createView(),

    depthClearValue: 1.0,
    depthLoadOp: 'clear',
    depthStoreOp: 'store',
  },
};

const aspect = canvas.width / canvas.height;
const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);
const modelViewProjectionMatrix = mat4.create();

function frame() {
  const transformationMatrix = getTransformationMatrix();
  device.queue.writeBuffer(
    uniformBuffer,
    0,
    transformationMatrix.buffer,
    transformationMatrix.byteOffset,
    transformationMatrix.byteLength
  );
  renderPassDescriptor.colorAttachments[0].view = context
    .getCurrentTexture()
    .createView();

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

  textRenderer.render(passEncoder, ...text);

  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // requestAnimationFrame(frame);
  updateReferenceElement();
}
requestAnimationFrame(frame);

// On wheel, increase/decrease the pixel scale of text[0]
let pixelScale = 1 / 128;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  pixelScale -= e.deltaY / 1000;
  text[0].setPixelScale(pixelScale);
  frame();
});

// Global translation variable
const globalTranslation = vec3.create();
let isDragging = false;
let lastMousePosition = { x: 0, y: 0 };

// Mouse events for dragging
canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  lastMousePosition = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const deltaX = e.clientX - lastMousePosition.x;
  const deltaY = e.clientY - lastMousePosition.y;

  // Update the translation values (scale movement for better control)
  const scaleFactor = 0.01;
  globalTranslation[0] += deltaX * scaleFactor;
  globalTranslation[1] -= deltaY * scaleFactor;

  lastMousePosition = { x: e.clientX, y: e.clientY };

  // Trigger rendering update
  frame();
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
  isDragging = false;
});

// Updated getTransformationMatrix
function getTransformationMatrix() {
  const now = Date.now() / 5000;
  const viewMatrix = mat4.identity();
  mat4.translate(viewMatrix, vec3.fromValues(0, 0, -5), viewMatrix);

  const modelMatrix = mat4.identity();
  mat4.translate(modelMatrix, vec3.fromValues(0, 2, -3), modelMatrix);
  mat4.rotate(
    modelMatrix,
    vec3.fromValues(Math.sin(now), Math.cos(now), 0),
    1,
    modelMatrix
  );

  // Update the matrix for the cube
  mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);
  mat4.multiply(
    modelViewProjectionMatrix,
    modelMatrix,
    modelViewProjectionMatrix
  );

  // Update the projection and view matrices for the text
  textRenderer.updateCamera(projectionMatrix, viewMatrix);

  // Update the transform of all the text surrounding the cube
  const textMatrix = mat4.create();
  for (const [index, transform] of textTransforms.entries()) {
    mat4.multiply(modelMatrix, transform, textMatrix);
    text[index].setTransform(textMatrix);
  }

  // Update the transform of the title text with global translation
  mat4.identity(textMatrix);
  mat4.translate(textMatrix, globalTranslation, textMatrix);
  titleText.setTransform(textMatrix);

  return modelViewProjectionMatrix;
}

const referenceElement = document.getElementById('reference');

function updateReferenceElement() {
  // Calculate CSS transform
  const scale = pixelScale * 128; // Reverse the pixel scaling for visual parity
  const translateX = (globalTranslation[0] * canvas.clientWidth) / 5 + 450;
  const translateY = (-globalTranslation[1] * canvas.clientHeight) / 5 + 450;

  // Apply CSS transforms to the reference element
  referenceElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  referenceElement.style.transformOrigin = 'center center';
}
