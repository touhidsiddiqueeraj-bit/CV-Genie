/* history */

/* Undo / redo.
 *
 * Snapshot stacks plus the two providers they operate on (getState /
 * restoreState live in state.js). They are injected once from main.js —
 * bindHistory() — so this module stays at the bottom of the graph with no
 * imports of its own and the stacks stay module-private. */

const undoStack=[],redoStack=[];
let providers=null;

export function bindHistory(p){providers=p;}

export function pushUndo(){
  undoStack.push(providers.getState());
  if(undoStack.length>50)undoStack.shift();
  redoStack.length=0;
  document.getElementById('redoBtn').disabled=true;
  document.getElementById('undoBtn').disabled=false;
}
export function undo(){
  if(!undoStack.length)return;
  redoStack.push(providers.getState());
  providers.restoreState(undoStack.pop());
  document.getElementById('redoBtn').disabled=false;
  if(!redoStack.length)document.getElementById('redoBtn').disabled=true;
}
export function redo(){
  if(!redoStack.length)return;
  undoStack.push(providers.getState());
  providers.restoreState(redoStack.pop());
  document.getElementById('undoBtn').disabled=false;
  if(!undoStack.length)document.getElementById('undoBtn').disabled=true;
}
