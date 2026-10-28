(() => {
  "use strict";
  if(window.__dashcraftGridSnapUiLoaded) return;
  window.__dashcraftGridSnapUiLoaded=true;
  const settings={
    xz:{title:"X/Z snap spacing",min:1,max:30,def:15,key:"__dcgs_snap_xz",storage:"dashcraftGridSnapXZ",unit:"units"},
    y:{title:"Y snap spacing",min:1,max:30,def:15,key:"__dcgs_snap_y",storage:"dashcraftGridSnapY",unit:"units"}
  };
  const logoUrl = chrome.runtime.getURL("logo.svg");
  const values={};
  for(const [key,cfg] of Object.entries(settings)) {
    values[key]=cfg.def;
    try { const n=Number.parseInt(localStorage.getItem(cfg.key)||"",10); if(Number.isInteger(n)&&n>=cfg.min&&n<=cfg.max) values[key]=n; } catch(_) {}
  }
  const style=document.createElement("style");
  style.textContent=`#dcgs-panel{position:fixed;z-index:2147483647;top:0;left:50%;width:min(390px,calc(100vw - 24px));max-height:90vh;overflow:auto;box-sizing:border-box;transform:translate(-50%,-110%);opacity:0;pointer-events:none;transition:transform 180ms ease,opacity 180ms ease;padding:14px 16px 15px;border:1px solid rgba(255,255,255,.16);border-top:0;border-radius:0 0 14px 14px;background:rgba(25,27,31,.97);color:#f5f5f5;box-shadow:0 10px 32px rgba(0,0,0,.38);font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;backdrop-filter:blur(10px)}#dcgs-panel.dcgs-open{transform:translate(-50%,0);opacity:1;pointer-events:auto}#dcgs-panel *{box-sizing:border-box}#dcgs-panel .dcgs-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}#dcgs-panel .dcgs-brand{display:flex;align-items:center;gap:10px;min-width:0}#dcgs-panel .dcgs-logo{width:34px;height:34px;object-fit:contain;border-radius:5px;flex:none;background:#fff}#dcgs-panel .dcgs-title{font-weight:750;font-size:15px}#dcgs-panel .dcgs-version{display:inline-block;margin-left:6px;padding:2px 5px;border-radius:5px;background:#343943;color:#c7cbd1;font-size:10px;font-weight:650;vertical-align:2px}#dcgs-panel .dcgs-key{border:1px solid #50545d;border-radius:5px;padding:2px 7px;color:#c7cbd1;font-size:11px}#dcgs-panel .dcgs-setting{padding:7px 0 10px;border-top:1px solid #3b3f47}#dcgs-panel .dcgs-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:5px}#dcgs-panel .dcgs-value{font-size:21px;font-weight:800;font-variant-numeric:tabular-nums}#dcgs-panel input[type=range]:disabled{opacity:.38;cursor:not-allowed}#dcgs-panel input[type=range]{display:block;width:100%;margin:7px 0;accent-color:#7db7ff;cursor:pointer}#dcgs-panel .dcgs-scale{display:flex;justify-content:space-between;color:#aeb4be;font-size:11px}#dcgs-panel .dcgs-note{margin-top:10px;color:#aeb4be;font-size:11px}#dcgs-panel .dcgs-status{margin-top:9px;padding:8px 9px;border-radius:7px;background:#202329;color:#d5d9e0;font-size:11px}#dcgs-panel .dcgs-close{color:#e8eaf0;background:#353941;border:1px solid #51555f;border-radius:7px;padding:5px 9px;cursor:pointer;font:inherit}`;
  (document.documentElement||document.head).appendChild(style);
  const panel=document.createElement("section"); panel.id="dcgs-panel"; panel.setAttribute("aria-label","SnapSickle Grid Snap");
  const root=document.documentElement;
  function getPatchStatus() {
    const patchState=root?.getAttribute("data-dcgs-patch");
    if(patchState==="applied") return `WASM patch active. X/Z: ${root.getAttribute("data-dcgs-xz")}; Y: ${root.getAttribute("data-dcgs-y")}. Grid texture tiling follows X/Z snap spacing; the original per-frame placement-plane Y uses the selected SnapSickle Y step.`;
    if(patchState==="mismatch") return `WASM patch not applied: ${root.getAttribute("data-dcgs-reason")||"build mismatch"}.`;
    if(patchState==="failed") return `WASM patch failed: ${root.getAttribute("data-dcgs-reason")||"see browser console"}.`;
    return "Waiting for DashCraft WASM to load; patch status is not confirmed yet.";
  }
  
  panel.innerHTML=`<div class="dcgs-header"><div class="dcgs-brand"><img class="dcgs-logo" src="${logoUrl}" alt="SnapSickle-logo"><div class="dcgs-title">SnapSickle <span style="font-weight:400;color:#aeb4be">Grid Snap</span><span class="dcgs-version">v1.0 test13</span></div></div><div><span class="dcgs-key">Ctrl</span> <button class="dcgs-close" type="button">Close</button></div></div>${Object.entries(settings).map(([key,cfg])=>`<div class="dcgs-setting"><div class="dcgs-row"><label for="dcgs-${key}">${cfg.title}</label><output class="dcgs-value" id="dcgs-${key}-value">${values[key]}</output></div><input id="dcgs-${key}" data-key="${key}" type="range" min="${cfg.min}" max="${cfg.max}" step="1" value="${values[key]}"><div class="dcgs-scale"><span>${cfg.min}</span><span>${Math.round((cfg.min+cfg.max)/2)}</span><span>${cfg.max}</span></div></div>`).join("")}<div class="dcgs-status" id="dcgs-status">${getPatchStatus()}</div><div class="dcgs-note">The game's original per-frame placement-plane Y update uses the selected SnapSickle Y step; the original cursor raycast remains active.</div>`;
  
  (document.documentElement||document.body).appendChild(panel);
  const status=panel.querySelector("#dcgs-status"); let isOpen=false;
  const patchObserver=new MutationObserver(()=>{status.textContent=getPatchStatus();});
  patchObserver.observe(root,{attributes:true,attributeFilter:["data-dcgs-patch","data-dcgs-reason","data-dcgs-xz","data-dcgs-y"]});
  function publish(key,raw) {
    const cfg=settings[key]; let n=Math.round(Math.max(cfg.min,Math.min(cfg.max,Number(raw))));
    values[key]=n; const slider=panel.querySelector(`#dcgs-${key}`); slider.value=String(n);
    const output=panel.querySelector(`#dcgs-${key}-value`); output.value=String(n); output.textContent=output.value;
    try { localStorage.setItem(cfg.key,String(n)); } catch(_) {}
    try { chrome.storage.local.set({[cfg.storage]:n}); } catch(_) {}
    status.textContent=`X/Z: ${values.xz}; Y: ${values.y} (applied after reload).`;
  }
  function setOpen(open) { isOpen=Boolean(open); panel.classList.toggle("dcgs-open",isOpen); panel.setAttribute("aria-hidden",String(!isOpen)); }
  for(const slider of panel.querySelectorAll('input[type="range"]')) slider.addEventListener("input",()=>publish(slider.dataset.key,slider.value));
  panel.querySelector(".dcgs-close").addEventListener("click",()=>setOpen(false));
  
  document.addEventListener("keydown",event=>{
    if (event.key === "Control" || event.code === "ControlLeft" || event.code === "ControlRight") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(!isOpen);
    }
  },true);
  
  try { chrome.storage.local.get(["dashcraftGridSnap",...Object.values(settings).map(v=>v.storage),"dashcraftGridSnapY"],result=>{for(const [key,cfg] of Object.entries(settings)){if(localStorage.getItem(cfg.key))continue;const stored=result[cfg.storage];const old=key==="xz"?result.dashcraftGridSnap:undefined;const n=Number.isInteger(stored)?stored:old;if(Number.isInteger(n)&&n>=cfg.min&&n<=cfg.max){panel.querySelector(`#dcgs-${key}`).value=String(n);publish(key,n);}}}); } catch(_) {}
})();
