# WebGPU Samples

**Please visit the [WebGPU Samples website](//webgpu.github.io/webgpu-samples/) to run the samples!**

The WebGPU Samples are a set of samples and demos
demonstrating the use of the [WebGPU API](//webgpu.dev). Please see the current
implementation status and how to run WebGPU in your browser at
[webgpu.io](//webgpu.io).

## Building
`webgpu-samples` is built with [Typescript](https://www.typescriptlang.org/)
and bundled using [Rollup](https://rollupjs.org/). Building the project
requires an installation of [Node.js](https://nodejs.org/en/).

- Install dependencies: `npm ci`.
- For development, start the dev server which will watch and recompile
  sources: `npm start`. You can navigate to http://localhost:8080 to view the project.
- For production, compile the project: `npm run build`.
- To run a production server to serve the built assets, do `npm run serve`.


## MSDF

Generate MSDF with:

```shell
npx msdf-bmfont -reuse -m 1024,1024 -f json -o public/assets/font/msdf.png -s 32 -r 4 -p 1 -t msdf public/assets/font/Corben-Regular.ttf
```
