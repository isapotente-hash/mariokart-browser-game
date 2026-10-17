export function formatTime(seconds:number):string {
  const minutes=Math.floor(seconds/60);return`${String(minutes).padStart(2,'0')}:${(seconds%60).toFixed(2).padStart(5,'0')}`;
}
export function keyLabel(code:string):string{return code.replace(/^Key/,'').replace(/^Digit/,'').replace('ArrowUp','↑').replace('ArrowDown','↓').replace('ArrowLeft','←').replace('ArrowRight','→').replace('ShiftLeft','Shift').replace('ShiftRight','Shift');}
