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

const Color   = {};
Color.BLACK   = [0, 0, 0];
Color.RED     = [255, 0, 0];
Color.GREEN   = [0, 255, 0];
Color.BLUE    = [0, 0, 255];
Color.YELLOW  = [255, 255, 0];
Color.PURPLE  = [255, 0, 255];
Color.TEAL    = [0, 255, 255];

const CellMoves = {};
CellMoves.DOWN       = 0b00000001;
CellMoves.DOWN_LEFT  = 0b00000010;
CellMoves.DOWN_RIGHT = 0b00000100;
CellMoves.LEFT       = 0b00001000;
CellMoves.RIGHT      = 0b00010000;

const Cell = {};
Cell.EMPTY  = 0;
Cell.SAND   = 1;
Cell.WATER  = 2;

Cell.intoColor = function(cell) {
  switch(cell) {
    case Cell.EMPTY:
      return Color.BLACK;
    case Cell.SAND:
      return Color.PURPLE;
    case Cell.WATER:
      return Color.TEAL;
  }
}

Cell.intoMoves = function(cell) {
  switch(cell) {
    case Cell.EMPTY:
      return null;
    case Cell.SAND:
      return CellMoves.DOWN | CellMoves.DOWN_LEFT | CellMoves.DOWN_RIGHT;
    case Cell.WATER:
      return CellMoves.DOWN | CellMoves.DOWN_LEFT | CellMoves.DOWN_RIGHT | CellMoves.LEFT | CellMoves.RIGHT;
  }
}

class World {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    
    this.cells = createTable(this.width, this.height, Cell.EMPTY);
    this.pixels = new Uint8Array(4 * this.width * this.height);
    this.tick = 0;
  }
  
  update() {
    this.tick++;
    const move_direction = this.tick % 2;
    
    for (let y = 0; y < this.height; y++) {
      const start = ((this.tick + y) % 2) * this.width;
      const end = (start == 0) * this.width;
      const direction = start == 0 ? 1 : -1;
      for (let x = start; x - end != 0; x += direction) {
        const myCell = this.getUnchecked(x, y);   // ASSUME COORDS ARE VALID
        const myCellMoves = Cell.intoMoves(myCell.read());
        if (myCellMoves) {
          // MOVE DOWN
          if (myCellMoves & CellMoves.DOWN) {
            const bottomCell = myCell.shifted(0, -1);
            if (bottomCell && bottomCell.isEmpty()) {
              CellRef.swap(myCell, bottomCell);
              continue;
            }
          }
          
          // MOVE BOTTOM LEFT AND RIGHT
          {
            const bottomLeftCell = myCellMoves & CellMoves.DOWN_LEFT && myCell.shifted(-1, -1) || null;
            const bottomRightCell = myCellMoves & CellMoves.DOWN_RIGHT && myCell.shifted(+1, -1) || null;
            
            const firstCell = move_direction % 2 == 0 ? bottomLeftCell : bottomRightCell;
            const secondCell = move_direction % 2 == 0 ? bottomRightCell : bottomLeftCell;
            
            if (firstCell && firstCell.isEmpty()) {
              CellRef.swap(myCell, firstCell);
              continue;
            } else if (secondCell && secondCell.isEmpty()) {
              CellRef.swap(myCell, secondCell);
              continue;
            }
          }
          
          // MOVE LEFT AND RIGHT
          {
            const leftCell = myCellMoves & CellMoves.LEFT && myCell.shifted(-1, 0) || null;
            const rightCell = myCellMoves & CellMoves.RIGHT && myCell.shifted(+1, 0) || null;
            
            const firstCell = move_direction % 2 == 0 ? leftCell : rightCell;
            const secondCell = move_direction % 2 == 0 ? rightCell : leftCell;
            
            if (firstCell && firstCell.isEmpty()) {
              CellRef.swap(myCell, firstCell);
              continue;
            } else if (secondCell && secondCell.isEmpty()) {
              CellRef.swap(myCell, secondCell);
              continue;
            }
          }
        }
      }
    }
    
    const BRUSH_SIZE = 10;
  
    // DRAW
    if (mouse.leftClick) {
      for (let dy = -BRUSH_SIZE; dy < BRUSH_SIZE; dy++) {
        for (let dx = -BRUSH_SIZE; dx < BRUSH_SIZE; dx++) {
          if (dx**2 + dy**2 < BRUSH_SIZE**2 && Math.random() < 0.3) {
            const x = mouse.x + dx;
            const y = mouse.y + dy;
            const cell = this.get(x, y);
            if (cell && cell.isEmpty()) {
              cell.write(Cell.SAND);
            }
          }
        }
      }
    }
    
    // ERASE
    if (mouse.rightClick) {
      for (let dy = -BRUSH_SIZE; dy < BRUSH_SIZE; dy++) {
        for (let dx = -BRUSH_SIZE; dx < BRUSH_SIZE; dx++) {
          if (dx**2 + dy**2 < BRUSH_SIZE**2) {
            const x = mouse.x + dx;
            const y = mouse.y + dy;
            const cell = this.get(x, y);
            if (cell && cell.isEmpty()) {
              cell.write(Cell.WATER);
            }
          }
        }
      }
    }
  }
  
  get(x, y) {
    return CellRef.getIfValid(this, x, y);
  }
  
  getUnchecked(x, y) {
    return new CellRef(this, x, y);
  }
  
  render() {
    let i = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.getUnchecked(x, y);
        const color = Cell.intoColor(cell.read());
        this.pixels[i++] = color[0];
        this.pixels[i++] = color[1];
        this.pixels[i++] = color[2];
        this.pixels[i++] = 255;
      }
    }
  }
  
  save() {
    const worldProps = JSON.stringify({
      width: this.width,
      height: this.height,
      cells: this.cells,
      tick: this.tick
    });
    localStorage.setItem("worldSave", worldProps);
  }
  
  static makeDefault() {
    const SCALE = 0.5;
    const WIDTH = 640 * SCALE;
    const HEIGHT = 480 * SCALE;
    return new World(WIDTH, HEIGHT);
  }
  
  static load() {
    const worldProps = JSON.parse(localStorage.getItem("worldSave"));
    const world = new World(worldProps.width, worldProps.height);
    world.cells = worldProps.cells;
    world.tick = worldProps.tick;
    return world;
  }
}

class CellRef {
  constructor(world, x, y) {
    this.world = world;
    this.x = x;
    this.y = y;
  }
  
  read() {
    return this.world.cells[this.y][this.x];
  }
  
  write(newCell) {
    this.world.cells[this.y][this.x] = newCell;
  }
  
  is(cell) {
    return this.read() == cell;
  }
  
  isEmpty() {
    return this.is(Cell.EMPTY);
  }
  
  shifted(dx, dy) {
    return CellRef.getIfValid(this.world, this.x + dx, this.y + dy);
  }
  
  static getIfValid(world, x, y) {
    if (0 <= x && x < world.width &&
        0 <= y && y < world.height) {
      return new CellRef(world, x, y);
    }
  }
  
  static swap(refCellA, refCellB) {
    const a = refCellA.read();
    const b = refCellB.read();
    refCellA.write(b);
    refCellB.write(a);
  }
}

let world = World.makeDefault();

const screenTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, screenTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

function updateScreenTexture(pixels) {
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
document.onkeydown = e => {  
  e.preventDefault();
};
document.onkeyup = e => {
  if (e.ctrlKey) {
    switch(e.code) {
      case "KeyS":
        world.save();
        break;
      case "KeyL":
        world = World.load();
        break;
      case "KeyR":
        world = World.makeDefault();
        break;
    }
  }
};

const start = Date.now();
const time = () => (Date.now() - start) / 1e3;

const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

function render() {
  stats.begin();
  gl.uniform2f(glLocations.u.resolution, screen.width, screen.height);
  gl.uniform1f(glLocations.u.time, time());
  
  world.render();
  updateScreenTexture(world.pixels);
  
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  stats.end();
  
  requestAnimationFrame(render);
}
render();

setInterval(function() {
  world.update();
}, 1e3/60);
