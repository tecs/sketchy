# Sketchy
A browser-based CAD application that aims to combine the simple and intuitive user interactions of direct 3D modelling software with the powerful features of parametric CAD software.

[User manual](docs/README.md)

## Features
- Parametric action tree
- Sketches based on constraints
- Bodies can be instanced and nested
- Instances can be individually transformed
- Scenes can be saved and loaded

## `DISCLAIMER`
This is a personal project, and as such was built for the sole purpose of gaining specific practical experience in the areas of linear algebra, analytic geometry, volumetric algorithms, simulations, iterative computation, shaders, application architecture, memory management, performance optimizations, and many more.

While everything advertised here *works correctly under very strict and limited usage conditions*, this application is in no way ready for any sort of production usage - it has a **huge** list of known bugs, performance issues, missing features, and sorely needed improvements.

On the flip side **there is** a huge list of known bugs, performance issues, missing features, and sorely needed improvements - which outlines a healthy future roadmap for the project.

## Running
Due to the secure context requirements of using `localStorage`, the application cannot be opened directly using the `file://` protocol, but rather must be hosted on a webserver

To view the application, a modern browser that supports ES6 and WebGL2 is required.

To access it at `http://localhost:8080` in the browser either Docker or NodeJS can be used out of the box:

### Docker
```sh
# Build the image (required once)
sudo docker build -t sketchy .

# Run
sudo docker run -p 8080:80 -d sketchy
```

### Node
```sh
# Run
npx http-server . -p 8080 -c-1 -s
```
