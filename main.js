(() => {
  "use strict";
  const WASM_BUILD = "236a06dc9063b747832944747c8d9f6c.wasm.br";
  const KEYS = { xz: "__dcgs_snap_xz", y: "__dcgs_snap_y", rotation: "__dcgs_rotation_step" };
  const DEFAULTS = { xz: 15, y: 15, rotation: 90 };
  const LIMITS = { xz: [1, 30], y: [1, 30], rotation: [1, 359] };
  const ROTATION_FUNCTIONS = [58120, 58127]; // ObjectPlacement.EditModeUpdate and MoveCursor
  const ROTATE_Y_90 = [
    0x43,0x00,0x00,0x00,0x00, // f32.const 0 (X)
    0x43,0x00,0x00,0xb4,0x42, // f32.const 90 (Y)
    0x43,0x00,0x00,0x00,0x00, // f32.const 0 (Z)
    0x41,0x00,0x10,0xc8,0xf3,0x04 // call Transform.Rotate (function 80328)
  ];

  // Patch grid spacing, camera/object level spacing, and the editor rotation step.
  // The game clamps editor levels to 100; raise both clamp operands to a
  // practical test ceiling so the camera can follow well beyond Y=1500.
  const SITES = [
    { offset: 0x1063153, kind: "float", type: "xz-half", original: 7.5 },
    { offset: 0x106317b, kind: "float", type: "xz-float", original: 15 },
    { offset: 0x10631d7, kind: "float", type: "xz-half", original: 7.5 },
    { offset: 0x10631ff, kind: "float", type: "xz-float", original: 15 },
    { offset: 0x106326a, kind: "int", type: "y-int", original: 15 },
    { offset: 0x1063271, kind: "int", type: "xz-int", original: 15 },
    { offset: 0x106327a, kind: "int", type: "xz-int", original: 15 },
    { offset: 0x106197d, kind: "int", type: "y-int", original: 15 },
    { offset: 0x10619e5, kind: "int", type: "y-int", original: 15 },
    { offset: 0x1061c94, kind: "int", type: "y-int", original: 15 }, // ObjectPlacement.Update resets placementPlane Y every frame
    { offset: 0x106389a, kind: "float", type: "y-float", original: 15 },
    { offset: 0x1062b11, kind: "int", type: "level-cap", original: 100, after: [0x20,0x04] },
    { offset: 0x1062b16, kind: "int", type: "level-cap", original: 100, after: [0x48] }
  ].sort((a,b)=>a.offset-b.offset);

  function readSetting(key) {
    const [min,max] = LIMITS[key];
    try {
      const n = Number.parseInt(localStorage.getItem(KEYS[key]) || String(DEFAULTS[key]), 10);
      if (Number.isInteger(n) && n >= min && n <= max) return n;
    } catch (_) {}
    return DEFAULTS[key];
  }
  function hasBytes(bytes, offset, expected) {
    return offset >= 0 && offset + expected.length <= bytes.length && expected.every((v,i)=>bytes[offset+i]===v);
  }
  function readLeb(bytes, pos) {
    let value=0, shift=0, p=pos, byte;
    do { if (p>=bytes.length || shift>35) throw new Error("Invalid WASM LEB128"); byte=bytes[p++]; value |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
    return { value: value >>> 0, next: p, length: p-pos };
  }
  function encodeUleb(value) {
    const out=[]; let v=value>>>0;
    do { let b=v&0x7f; v>>>=7; if(v) b|=0x80; out.push(b); } while(v);
    return out;
  }
  function encodeSignedLeb(value) {
    const out=[]; let more=true;
    while(more) {
      let byte=value & 0x7f; value >>= 7;
      const sign=(byte & 0x40)!==0;
      more=!((value===0 && !sign)||(value===-1 && sign));
      if(more) byte |= 0x80;
      out.push(byte);
    }
    return out;
  }
  function encodeF32(value) {
    const bytes=new Uint8Array(4); new DataView(bytes.buffer).setFloat32(0,value,true); return [...bytes];
  }
  function concat(parts) {
    const length=parts.reduce((n,p)=>n+p.length,0), out=new Uint8Array(length); let at=0;
    for(const part of parts){out.set(part,at);at+=part.length;} return out;
  }
  function findSequences(bytes, sequence) {
    const matches=[];
    for(let i=0;i<=bytes.length-sequence.length;i++) {
      let found=true;
      for(let j=0;j<sequence.length;j++) if(bytes[i+j]!==sequence[j]) { found=false; break; }
      if(found) matches.push(i);
    }
    return matches;
  }
  function addRotationEdits(bodies, degrees) {
    for(const functionIndex of ROTATION_FUNCTIONS) {
      const body=bodies.find(candidate=>candidate.functionIndex===functionIndex);
      if(!body) throw new Error(`Rotation function ${functionIndex} not found`);
      const matches=findSequences(body.bytes,ROTATE_Y_90);
      if(matches.length!==1) throw new Error(`Expected one 90-degree Transform.Rotate anchor in function ${functionIndex}; found ${matches.length}`);
      const at=body.start+matches[0]+5; // replace the 90-degree f32.const only
      body.edits.push({at,oldLength:5,replacement:new Uint8Array([0x43,...encodeF32(degrees)]),baseOffset:at});
    }
  }
  function gridTextureInjection(xz) {
    const tiling=1500/xz; // fixed 1500-unit grid footprint; base material is 100 at X/Z snap 15
    return new Uint8Array([
      // ApplySettings has no stack frame; reserve 16 bytes from verified global stack pointer.
      0x23,0x00, 0x41,0x10, 0x6b, 0x22,0x02, 0x24,0x00,
      0x20,0x00, 0x28,0x02,0x54, 0x21,0x01, // BuildSettings.grid GameObject
      0x20,0x01, 0x45, 0x04,0x40, 0x05,
      0x20,0x01, 0x41,0x00, 0x10,...encodeUleb(80017), 0x21,0x01, // get Transform
      0x20,0x01, 0x45, 0x04,0x40, 0x05,
      0x41,...encodeSignedLeb(5403640), 0x10,...encodeUleb(1870), // initialize the generic MethodInfo slot, as vanilla call sites do
      0x20,0x01, 0x41,...encodeSignedLeb(5403640), 0x28,0x02,0x00, 0x10,...encodeUleb(69304), 0x21,0x01, // load MethodInfo* then call GetComponentInChildren<Renderer>
      0x20,0x01, 0x45, 0x04,0x40, 0x05,
      0x20,0x01, 0x41,0x00, 0x10,...encodeUleb(66481), 0x21,0x01, // Renderer.get_material
      0x20,0x01, 0x45, 0x04,0x40, 0x05,
      0x20,0x02, 0x43,...encodeF32(tiling), 0x38,0x02,0x00,
      0x20,0x02, 0x43,...encodeF32(tiling), 0x38,0x02,0x04,
      0x20,0x01, 0x20,0x02, 0x41,0x00, 0x10,...encodeUleb(66556), // Material.set_mainTextureScale(Vector2*) uses the shader main-texture property
      0x0b,0x0b,0x0b,0x0b,
      0x20,0x02, 0x41,0x10, 0x6a, 0x24,0x00 // restore stack pointer
    ]);
  }

  function parseImportedCounts(section) {
    if(!section) return {functions:0,globals:0};
    const b=section.payload; let p=0; const count=readLeb(b,p); p=count.next;
    let functions=0,globals=0;
    for(let i=0;i<count.value;i++) {
      for(let n=0;n<2;n++){const name=readLeb(b,p);p=name.next+name.value;}
      const kind=b[p++];
      if(kind===0){p=readLeb(b,p).next;functions++;}
      else if(kind===1){p++;const flags=readLeb(b,p);p=readLeb(b,flags.next).next;if(flags.value&1)p=readLeb(b,p).next;}
      else if(kind===2){const flags=readLeb(b,p);p=readLeb(b,flags.next).next;if(flags.value&1)p=readLeb(b,p).next;}
      else if(kind===3){p+=2;globals++;}
      else if(kind===4){p=readLeb(b,p).next;p=readLeb(b,p).next;}
      else throw new Error(`Unknown WASM import kind ${kind}`);
    }
    if(p!==b.length) throw new Error("Could not parse WASM imports exactly");
    return {functions,globals};
  }
  function parseSections(bytes) {
    const sections=[]; let p=8;
    while(p<bytes.length) {
      const begin=p, id=bytes[p++], size=readLeb(bytes,p), payloadStart=size.next, payloadEnd=payloadStart+size.value;
      if(payloadEnd>bytes.length) throw new Error("WASM section extends beyond file");
      sections.push({id,begin,payloadStart,payloadEnd,payload:bytes.subarray(payloadStart,payloadEnd)}); p=payloadEnd;
    }
    return sections;
  }
  function makeResponse(bytes, original) {
    const headers=new Headers(original.headers);
    headers.delete("content-encoding"); headers.delete("content-length"); headers.delete("content-range");
    headers.set("content-type","application/wasm");
    return new Response(bytes,{status:original.status,statusText:original.statusText,headers});
  }
  function patchWasm(buffer, values) {
    const original=new Uint8Array(buffer);
    if(original.length<8 || original[0]!==0 || original[1]!==0x61 || original[2]!==0x73 || original[3]!==0x6d)
      return {ok:false,reason:"WASM header mismatch",bytes:original};
    let sections;
    try { sections=parseSections(original); } catch(e) { return {ok:false,reason:e.message,bytes:original}; }
    const code=sections.find(s=>s.id===10);
    if(!code) return {ok:false,reason:"WASM code section not found",bytes:original};
    try {
      const imported=parseImportedCounts(sections.find(s=>s.id===2));
      let q=code.payloadStart; const count=readLeb(original,q); q=count.next;
      const bodies=[];
      for(let i=0;i<count.value;i++) {
        const size=readLeb(original,q), bodyStart=size.next, bodyEnd=bodyStart+size.value;
        if(bodyEnd>code.payloadEnd) throw new Error("WASM function extends beyond code section");
        bodies.push({index:imported.functions+i,functionIndex:imported.functions+i,start:bodyStart,end:bodyEnd,bytes:original.subarray(bodyStart,bodyEnd),edits:[]});
        q=bodyEnd;
      }
      if(q!==code.payloadEnd) throw new Error("Could not parse WASM code section exactly");

      for(const site of SITES) {
        // All byte anchors refer to the untouched input module; edits are
        // collected against those original offsets and applied together.
        const at=site.offset;
        if(site.kind==="float") {
          if(at<0 || at+5>original.length || original[at]!==0x43)
            throw new Error(`WASM target mismatch at 0x${site.offset.toString(16)} (float)`);
          const body=bodies.find(b=>at>=b.start && at<b.end);
          if(!body) throw new Error(`No function body at 0x${site.offset.toString(16)}`);
          let replacementValue;
          if(site.type==="xz-half") replacementValue=values.xz/2;
          else if(site.type==="xz-float") replacementValue=values.xz;
          else if(site.type==="y-float") replacementValue=values.y;
          else replacementValue=site.original;
          const replacement=new Uint8Array(5); replacement[0]=0x43;
          new DataView(replacement.buffer).setFloat32(1,replacementValue,true);
          body.edits.push({at,oldLength:5,replacement,baseOffset:site.offset});
        } else {
          if(at<0 || at+2>=original.length || original[at]!==0x41)
            throw new Error(`WASM target mismatch at 0x${site.offset.toString(16)} (integer)`);
          let pos=at+1, shift=0, byte, immediateLength=0;
          do {
            if(pos>=original.length || shift>35) throw new Error("Invalid signed LEB128 at patch target");
            byte=original[pos++]; immediateLength++; shift+=7;
          } while(byte&0x80);
          const following=site.after||[0x6c];
          if(!following.every((value,index)=>original[at+1+immediateLength+index]===value))
            throw new Error(`WASM multiply instruction mismatch at 0x${site.offset.toString(16)}`);
          const oldLength=1+immediateLength;
          const body=bodies.find(b=>at>=b.start && at<b.end);
          if(!body) throw new Error(`No function body at 0x${site.offset.toString(16)}`);
          let replacementValue=site.original;
          if(site.type==="y-int") replacementValue=values.y;
          else if(site.type==="xz-int") replacementValue=values.xz;
          else if(site.type==="level-cap") replacementValue=100000;
          const replacement=new Uint8Array([0x41,...encodeSignedLeb(replacementValue)]);
          body.edits.push({at,oldLength,replacement,baseOffset:site.offset});
        }
      }

      // Replace only the editor's two verified Transform.Rotate(0, 90, 0) steps.
      // Function-relative anchors tolerate the supplied WASM variants' differing body lengths.
      addRotationEdits(bodies,values.rotation);

      // BuildSettings.grid is the visible grid object. Set the child Grid material's
      // texture tiling at the ApplySettings point, retaining the plane size.
      const gridBody=bodies.find(b=>b.functionIndex===58206);
      const gridInsertionAt=gridBody?.start+112;
      if(!gridBody || original[gridInsertionAt]!==0x20 || original[gridInsertionAt+1]!==0x00)
        throw new Error("Visible-grid ApplySettings anchor mismatch");
      gridBody.edits.push({at:gridInsertionAt,oldLength:0,replacement:gridTextureInjection(values.xz),baseOffset:gridInsertionAt});

      const rebuiltBodies=[];
      for(const body of bodies) {
        if(!body.edits.length) { rebuiltBodies.push(concat([encodeUleb(body.bytes.length),body.bytes])); continue; }
        body.edits.sort((a,b)=>a.at-b.at);
        const pieces=[]; let cursor=body.start;
        for(const edit of body.edits) {
          if(edit.at<cursor || edit.at+edit.oldLength>body.end) throw new Error("Overlapping or out-of-range WASM patch");
          pieces.push(original.subarray(cursor,edit.at));
          pieces.push(edit.replacement);
          cursor=edit.at+edit.oldLength;
        }
        pieces.push(original.subarray(cursor,body.end));
        const bodyBytes=concat(pieces);
        rebuiltBodies.push(concat([encodeUleb(bodyBytes.length),bodyBytes]));
      }
      const newCodePayload=concat([encodeUleb(count.value),...rebuiltBodies]);
      const newCodeSection=concat([new Uint8Array([10]),encodeUleb(newCodePayload.length),newCodePayload]);
      const outSections=[];
      for(const section of sections) outSections.push(section.id===10?newCodeSection:original.subarray(section.begin,section.payloadEnd));
      return {ok:true,bytes:concat([original.subarray(0,8),...outSections])};
    } catch(e) { return {ok:false,reason:e.message,bytes:original}; }
  }

  if(window.__snapSickleGridSnap100Test2Installed) return;
  window.__snapSickleGridSnap100Test2Installed=true;
  const originalFetch=window.fetch;
  if(typeof originalFetch!=="function") return;
  window.fetch=async function(input,init) {
    const response=await Reflect.apply(originalFetch,this,[input,init]);
    let url=""; try { url=typeof input==="string" ? input : input.url; } catch (_) {}
    if(!url.includes(WASM_BUILD) || !response.ok) return response;
    let originalBytes;
    try {
      originalBytes=await response.arrayBuffer();
      const values={xz:readSetting("xz"),y:readSetting("y"),rotation:readSetting("rotation")};
      const result=patchWasm(originalBytes,values);
      if(!result.ok) {
        console.warn(`[DashCraft Grid Snap] WASM was not patched (${result.reason}); original bytes are preserved.`);
        document.documentElement?.setAttribute("data-dcgs-patch","mismatch");
        document.documentElement?.setAttribute("data-dcgs-reason",result.reason);
        return makeResponse(result.bytes,response);
      }
      document.documentElement?.setAttribute("data-dcgs-patch","applied");
      document.documentElement?.setAttribute("data-dcgs-xz",String(values.xz));
      document.documentElement?.setAttribute("data-dcgs-y",String(values.y));
      document.documentElement?.setAttribute("data-dcgs-rotation",String(values.rotation));
      console.info(`[SnapSickle Grid Snap 3.0.0] X/Z: ${values.xz}; Y: ${values.y}; rotation step: ${values.rotation} degrees.`);
      return makeResponse(result.bytes,response);
    } catch(error) {
      console.error("[DashCraft Grid Snap] Patch failed; original game code remains available.",error);
      document.documentElement?.setAttribute("data-dcgs-patch","failed");
      document.documentElement?.setAttribute("data-dcgs-reason",String(error?.message||error));
      if(originalBytes) return makeResponse(originalBytes,response);
      return response;
    }
  };
})();
