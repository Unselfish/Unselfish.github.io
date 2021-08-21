const gl = screen.getContext("webgl", {antialias: false});

const vertexSource = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0., 1.);
}
`;

const fragmentSource = `
#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_resolution;
uniform sampler2D u_screenTexture;

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution;
  gl_FragColor = texture2D(u_screenTexture, st);
}
`;

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  alert('COMPILE ERROR');
  
  const info = gl.getShaderInfoLog(fragmentShader);
  throw info;
}

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(
  gl.ARRAY_BUFFER, 
  new Float32Array([
    -1.0, -1.0, 
     1.0, -1.0, 
    -1.0,  1.0, 
    -1.0,  1.0, 
     1.0, -1.0, 
     1.0,  1.0]), 
  gl.STATIC_DRAW
);

const glLocations = {
  a: {
    position: gl.getAttribLocation(program, "a_position"),
  },
  u: {
    time: gl.getUniformLocation(program, "u_time"),
    resolution: gl.getUniformLocation(program, "u_resolution"),
    screenTexture: gl.getUniformLocation(program, "u_screenTexture")
  }
};

gl.enableVertexAttribArray(glLocations.a.position);
gl.vertexAttribPointer(glLocations.a.position, 2, gl.FLOAT, false, 0, 0);

gl.uniform2f(glLocations.u.resolution, screen.width, screen.height);

const SCALE = 0.5;
const world = {
  width: 640 * SCALE,
  height: 480 * SCALE
};

const pixels = new Uint8Array(4 * world.width * world.height);

const screenTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, screenTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

function updateScreenTexture() {
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = world.width;
  const height = world.height;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  gl.bindTexture(gl.TEXTURE_2D, screenTexture);
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixels);
}

gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, screenTexture);
gl.uniform1i(glLocations.u.screenTexture, 0);

const mouse = {
  x: 0,
  y: 0,
  leftClick: false,
  rightClick: false,
};

screen.onmousemove = e => {
  const rect = screen.getBoundingClientRect();
  mouse.x = Math.floor((e.clientX - rect.left) * world.width / screen.width);
  mouse.y = Math.floor(world.height - (e.clientY - rect.top) * world.height / screen.height);
}

screen.onmousedown = e => {
  if (e.button == 0) {
    mouse.leftClick = true;
  } else if (e.button == 2) {
    mouse.rightClick = true;
  }
};
screen.onmouseup = e => {
  if (e.button == 0) {
    mouse.leftClick = false;
  } else if (e.button == 2) {
    mouse.rightClick = false;
  }
}

function createTable(width, height, default_value) {
  const table = new Array(height);
  for (let i = 0; i < table.length; i++) {
    table[i] = new Array(width);
    for (let j = 0; j < table[i].length; j++) {
      table[i][j] = default_value;
    }
  }
  return table;
}

const Cell = {};
Cell.EMPTY = 0;
Cell.SAND = 1;

const cells = createTable(world.width, world.height, Cell.EMPTY);

const start = Date.now();

const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

function getCell(x, y) {
  const row = cells[y];
  if (row == null) return null;
  return row[x];
}

function update() {
  const BRUSH_SIZE = 10;
  
  // DRAW
  if (mouse.leftClick) {
    for (let dy = -BRUSH_SIZE; dy < BRUSH_SIZE; dy++) {
      for (let dx = -BRUSH_SIZE; dx < BRUSH_SIZE; dx++) {
        if (dx == dy || dx == -dy) {
          const x = mouse.x + dx;
          const y = mouse.y + dy;
          if (getCell(x, y) == Cell.EMPTY) {
            cells[y][x] = Cell.SAND;
          }
        }
      }
    }
  }
  
  // ERASE
  if (mouse.rightClick) {
    for (let y = mouse.y - BRUSH_SIZE; y < mouse.y + BRUSH_SIZE; y++) {
      for (let x = mouse.x - BRUSH_SIZE; x < mouse.x + BRUSH_SIZE; x++) {
        if (getCell(x, y) == Cell.SAND) {
          cells[y][x] = Cell.EMPTY;
        }
      }
    }
  }
  
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = cells[y][x];
      switch (cell) {
        case Cell.EMPTY:
          break;
        case Cell.SAND:
          if (getCell(x, y-1) == Cell.EMPTY) {
            cells[y][x] = Cell.EMPTY;
            cells[y-1][x] = Cell.SAND;
          } else if (getCell(x-1, y-1) == Cell.EMPTY) {
            cells[y][x] = Cell.EMPTY;
            cells[y-1][x-1] = Cell.SAND;
          } else if (getCell(x+1, y-1) == Cell.EMPTY) {
            cells[y][x] = Cell.EMPTY;
            cells[y-1][x+1] = Cell.SAND;
          }
      }
    }
  }
}

function render() {
  stats.begin();
  const time = (Date.now() - start) / 1e3;
  gl.uniform1f(glLocations.u.time, time);
  
  let i = 0;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = cells[y][x];
      switch (cell) {
        case Cell.EMPTY:
          pixels[i++] = 0;
          pixels[i++] = 0;
          pixels[i++] = 0;
          break;
        case Cell.SAND:
          pixels[i++] = 255;
          pixels[i++] = 255;
          pixels[i++] = 0;
          break;
      }
      pixels[i++] = 255;
    }
  }
  
  updateScreenTexture();
  
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  stats.end();
  
  requestAnimationFrame(render);
}
render();

setInterval(update, 1e3/60);
