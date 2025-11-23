// Simple, stable Tetris engine (no fancy stuff, just classic feel)
(function(){
  var COLS = 10;
  var ROWS = 20;
  var board = []; // [row][col]
  var current = null;
  var next = null;
  var score = 0;
  var level = 1;
  var lines = 0;
  var tickInterval = 800; // ms
  var timerId = null;
  var running = false;
  var paused = false;
  var soundOn = true;

  var boardEl = document.getElementById('board');
  var nextEl = document.getElementById('next');
  var overlayEl = document.getElementById('overlay');
  var overlayTextEl = document.getElementById('overlay-text');
  var overlayButtonEl = document.getElementById('overlay-button');
  var scoreEl = document.getElementById('score');
  var levelEl = document.getElementById('level');
  var linesEl = document.getElementById('lines');
  var btnPlay = document.getElementById('btn-play');
  var btnPause = document.getElementById('btn-pause');
  var btnQuit = document.getElementById('btn-quit');

  // expose sound toggle hook for Angular
  window.__tetrisSetSoundOn = function(v){ soundOn = v; };

  // tetromino definitions (each has 4 rotation states)
  var TETROMINOES = [
    // I
    {
      id:1,
      rotations:[
        [{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:3,y:1}],
        [{x:2,y:0},{x:2,y:1},{x:2,y:2},{x:2,y:3}],
        [{x:0,y:2},{x:1,y:2},{x:2,y:2},{x:3,y:2}],
        [{x:1,y:0},{x:1,y:1},{x:1,y:2},{x:1,y:3}]
      ]
    },
    // O
    {
      id:2,
      rotations:[
        [{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:1}],
        [{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:1}],
        [{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:1}],
        [{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:1}]
      ]
    },
    // T
    {
      id:3,
      rotations:[
        [{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],
        [{x:1,y:0},{x:1,y:1},{x:2,y:1},{x:1,y:2}],
        [{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:1,y:2}],
        [{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:1,y:2}]
      ]
    },
    // S
    {
      id:4,
      rotations:[
        [{x:1,y:0},{x:2,y:0},{x:0,y:1},{x:1,y:1}],
        [{x:1,y:0},{x:1,y:1},{x:2,y:1},{x:2,y:2}],
        [{x:1,y:1},{x:2,y:1},{x:0,y:2},{x:1,y:2}],
        [{x:0,y:0},{x:0,y:1},{x:1,y:1},{x:1,y:2}]
      ]
    },
    // Z
    {
      id:5,
      rotations:[
        [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:1}],
        [{x:2,y:0},{x:1,y:1},{x:2,y:1},{x:1,y:2}],
        [{x:0,y:1},{x:1,y:1},{x:1,y:2},{x:2,y:2}],
        [{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:0,y:2}]
      ]
    },
    // J
    {
      id:6,
      rotations:[
        [{x:0,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],
        [{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:1,y:2}],
        [{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:2,y:2}],
        [{x:1,y:0},{x:1,y:1},{x:0,y:2},{x:1,y:2}]
      ]
    },
    // L
    {
      id:7,
      rotations:[
        [{x:2,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],
        [{x:1,y:0},{x:1,y:1},{x:1,y:2},{x:2,y:2}],
        [{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:0,y:2}],
        [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:1,y:2}]
      ]
    }
  ];

  function createBoard(){
    board = [];
    for(var r=0;r<ROWS;r++){
      var row = [];
      for(var c=0;c<COLS;c++){ row.push(0); }
      board.push(row);
    }
  }

  function createCells(){
    boardEl.innerHTML = "";
    for(var i=0;i<ROWS*COLS;i++){
      var div = document.createElement('div');
      div.className = "cell";
      boardEl.appendChild(div);
    }
  }

  function getCellElement(row, col){
    var index = row * COLS + col;
    return boardEl.children[index];
  }

  function randomTetromino(){
    var idx = Math.floor(Math.random()*TETROMINOES.length);
    var t = TETROMINOES[idx];
    return {
      id: t.id,
      rotations: t.rotations,
      rotationIndex: 0,
      x: 3, // spawn near middle
      y: 0
    };
  }

  function cloneTetromino(t){
    return {
      id: t.id,
      rotations: t.rotations,
      rotationIndex: t.rotationIndex,
      x: t.x,
      y: t.y
    };
  }

  function getBlocks(piece){
    var rot = piece.rotations[piece.rotationIndex];
    var blocks = [];
    for(var i=0;i<rot.length;i++){
      blocks.push({ x: piece.x + rot[i].x, y: piece.y + rot[i].y });
    }
    return blocks;
  }

  function canMove(piece, dx, dy, newRotIndex){
    var test = cloneTetromino(piece);
    if(typeof newRotIndex === "number") test.rotationIndex = newRotIndex;
    test.x += dx;
    test.y += dy;
    var blocks = getBlocks(test);
    for(var i=0;i<blocks.length;i++){
      var b = blocks[i];
      if(b.x < 0 || b.x >= COLS || b.y >= ROWS) return false;
      if(b.y >= 0 && board[b.y][b.x] !== 0) return false;
    }
    return true;
  }

  function placePiece(){
    var blocks = getBlocks(current);
    for(var i=0;i<blocks.length;i++){
      var b = blocks[i];
      if(b.y >= 0 && b.y < ROWS && b.x >= 0 && b.x < COLS){
        board[b.y][b.x] = current.id;
      }
    }
  }

  function clearLines(){
    var cleared = 0;
    for(var r=ROWS-1;r>=0;r--){
      var full = true;
      for(var c=0;c<COLS;c++){
        if(board[r][c] === 0){
          full = false;
          break;
        }
      }
      if(full){
        board.splice(r,1);
        var newRow = [];
        for(var k=0;k<COLS;k++) newRow.push(0);
        board.unshift(newRow);
        cleared++;
        r++;
      }
    }
    if(cleared > 0){
      lines += cleared;
      score += cleared * 100;
      level = 1 + Math.floor(lines / 10);
      tickInterval = Math.max(150, 800 - (level-1) * 60);
      playBeep(0.08, 800);
    }
  }

  function spawn(){
    current = next || randomTetromino();
    next = randomTetromino();
    current.x = 3;
    current.y = 0;
    current.rotationIndex = 0;
    if(!canMove(current,0,0,current.rotationIndex)){
      gameOver();
    }
    drawNext();
  }

  function hardDrop(){
    if(!current) return;
    while(canMove(current,0,1,current.rotationIndex)){
      current.y += 1;
    }
    placePiece();
    clearLines();
    spawn();
  }

  function rotate(){
    if(!current) return;
    var newIndex = (current.rotationIndex + 1) % current.rotations.length;
    if(canMove(current,0,0,newIndex)){
      current.rotationIndex = newIndex;
    } else if(canMove(current,-1,0,newIndex)){
      current.rotationIndex = newIndex;
      current.x -= 1;
    } else if(canMove(current,1,0,newIndex)){
      current.rotationIndex = newIndex;
      current.x += 1;
    }
  }

  function step(){
    if(!running || paused) return;
    if(canMove(current,0,1,current.rotationIndex)){
      current.y += 1;
    } else {
      placePiece();
      clearLines();
      spawn();
    }
    draw();
  }

  function startLoop(){
    if(timerId) clearInterval(timerId);
    timerId = setInterval(step, tickInterval);
  }

  function stopLoop(){
    if(timerId){
      clearInterval(timerId);
      timerId = null;
    }
  }

  function draw(){
    // clear all cells
    for(var r=0;r<ROWS;r++){
      for(var c=0;c<COLS;c++){
        var cell = getCellElement(r,c);
        cell.className = "cell";
        var val = board[r][c];
        if(val){
          cell.classList.add("filled-" + val);
        }
      }
    }
    // draw ghost
    if(current){
      var ghost = cloneTetromino(current);
      while(canMove(ghost,0,1,ghost.rotationIndex)){
        ghost.y += 1;
      }
      var gb = getBlocks(ghost);
      for(var i=0;i<gb.length;i++){
        var g = gb[i];
        if(g.y >= 0 && g.y < ROWS && g.x >= 0 && g.x < COLS){
          var cellG = getCellElement(g.y,g.x);
          if(!cellG.className.includes("filled-")){
            cellG.classList.add("ghost");
          }
        }
      }
    }
    // draw current piece
    if(current){
      var blocks = getBlocks(current);
      for(var j=0;j<blocks.length;j++){
        var b = blocks[j];
        if(b.y >= 0 && b.y < ROWS && b.x >= 0 && b.x < COLS){
          var cell2 = getCellElement(b.y,b.x);
          cell2.className = "cell filled-" + current.id;
        }
      }
    }
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  function drawNext(){
    if(!nextEl) return;
    nextEl.innerHTML = "";
    for(var i=0;i<16;i++){
      var d = document.createElement('div');
      d.className = "mini-cell";
      nextEl.appendChild(d);
    }
    var cells = nextEl.children;
    var gridSize = 4;
    var r,c,index;
    // mark cells based on next piece blocks
    var minX = 10, minY = 10;
    var tpl = next.rotations[0];
    for(var i=0;i<tpl.length;i++){
      if(tpl[i].x < minX) minX = tpl[i].x;
      if(tpl[i].y < minY) minY = tpl[i].y;
    }
    for(i=0;i<tpl.length;i++){
      r = tpl[i].y - minY + 1;
      c = tpl[i].x - minX;
      if(r >= 0 && r < gridSize && c >= 0 && c < gridSize){
        index = r * gridSize + c;
        cells[index].className = "mini-cell filled-" + next.id;
      }
    }
  }

  function resetGame(){
    createBoard();
    createCells();
    score = 0;
    level = 1;
    lines = 0;
    tickInterval = 800;
    running = false;
    paused = false;
    next = randomTetromino();
    draw();
    drawNext();
    showOverlay("Press Start to play");
  }

  function startGame(){
    createBoard();
    createCells();
    score = 0;
    level = 1;
    lines = 0;
    tickInterval = 800;
    running = true;
    paused = false;
    hideOverlay();
    next = randomTetromino();
    spawn();
    draw();
    startLoop();
  }

  function pauseGame(){
    if(!running) return;
    paused = !paused;
    if(paused){
      showOverlay("Paused");
    } else {
      hideOverlay();
    }
  }

  function quitGame(){
    running = false;
    paused = false;
    stopLoop();
    resetGame();
  }

  function gameOver(){
    running = false;
    paused = false;
    stopLoop();
    showOverlay("Game Over<br>Score: " + score);
  }

  function showOverlay(html){
    overlayTextEl.innerHTML = html;
    overlayEl.style.display = "flex";
  }

  function hideOverlay(){
    overlayEl.style.display = "none";
  }

  function handleKey(e){
    if(!running){
      if(e.code === "Space"){
        e.preventDefault();
        startGame();
      }
      return;
    }
    if(e.code === "KeyP"){
      e.preventDefault();
      pauseGame();
      return;
    }
    if(e.code === "Escape"){
      e.preventDefault();
      quitGame();
      return;
    }
    if(paused) return;

    if(e.code === "ArrowLeft"){
      e.preventDefault();
      if(canMove(current,-1,0,current.rotationIndex)){
        current.x -= 1;
      }
    } else if(e.code === "ArrowRight"){
      e.preventDefault();
      if(canMove(current,1,0,current.rotationIndex)){
        current.x += 1;
      }
    } else if(e.code === "ArrowDown"){
      e.preventDefault();
      if(canMove(current,0,1,current.rotationIndex)){
        current.y += 1;
      }
    } else if(e.code === "ArrowUp"){
      e.preventDefault();
      rotate();
    } else if(e.code === "Space"){
      e.preventDefault();
      hardDrop();
    }
    draw();
  }

  // simple beep
  var audioCtx = null;
  function playBeep(duration, freq){
    if(!soundOn) return;
    if(typeof window.AudioContext === "undefined" && typeof window.webkitAudioContext === "undefined"){
      return;
    }
    try{
      if(!audioCtx){
        var AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
      }
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = freq || 440;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.stop(audioCtx.currentTime + duration);
    } catch(err){}
  }

  // wire UI buttons
  overlayButtonEl.addEventListener('click', function(){
    if(!running){
      startGame();
    }
  });
  btnPlay.addEventListener('click', function(){ startGame(); });
  btnPause.addEventListener('click', function(){ pauseGame(); });
  btnQuit.addEventListener('click', function(){ quitGame(); });

  boardEl.addEventListener('keydown', handleKey);
  // also listen on window (in case focus lost)
  window.addEventListener('keydown', handleKey);

  // init
  resetGame();
})();