(function(){
  "use strict";

  const THREE_SRC="vendor/three.min.js";
  const THREE_FALLBACK_SRC="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
  const states=new Set();
  let loaderStarted=false;
  let frameId=null;

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function reducedMotion(){return !!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);}

  function material(THREE,color,options){
    return new THREE.MeshStandardMaterial(Object.assign({color,roughness:.62,metalness:.06},options||{}));
  }

  function addBox(THREE,parent,w,h,d,x,y,z,mat,cast=true,receive=true){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);
    mesh.castShadow=cast;
    mesh.receiveShadow=receive;
    parent.add(mesh);
    return mesh;
  }

  function addCylinder(THREE,parent,radiusTop,radiusBottom,height,x,y,z,mat,segments=20,cast=true,receive=true){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radiusTop,radiusBottom,height,segments),mat);
    mesh.position.set(x,y,z);
    mesh.castShadow=cast;
    mesh.receiveShadow=receive;
    parent.add(mesh);
    return mesh;
  }

  function addSphere(THREE,parent,radius,x,y,z,mat,cast=true,receive=true){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,18,12),mat);
    mesh.position.set(x,y,z);
    mesh.castShadow=cast;
    mesh.receiveShadow=receive;
    parent.add(mesh);
    return mesh;
  }

  function addRod(THREE,parent,a,b,r,mat){
    const direction=b.clone().sub(a);
    const length=direction.length();
    if(!length)return null;
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,8),mat);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  }

  function addWindow(THREE,parent,x,y,z,w,h,d,mat){
    const windowMesh=addBox(THREE,parent,w,h,d,x,y,z,mat,false,true);
    windowMesh.userData.isWindow=true;
    return windowMesh;
  }

  function buildConstructionModel(THREE,pct){
    const group=new THREE.Group();
    group.position.y=-.25;
    const building=new THREE.Group();
    building.position.x=-.55;
    group.add(building);

    const colors={
      ground:0x00343D,
      concrete:0xC2D0CA,
      concreteDark:0x829D98,
      steel:0x163C45,
      glass:0x7EE0D6,
      glassLit:0xD6FB00,
      lime:0xD6FB00,
      pale:0xECFFB6,
      safety:0xF6B83F,
      shadow:0x062A33
    };
    const facadeMat=material(THREE,colors.concrete,{roughness:.78});
    const slabMat=material(THREE,colors.concreteDark,{roughness:.7,metalness:.1});
    const steelMat=material(THREE,colors.steel,{roughness:.36,metalness:.72});
    const glassMat=new THREE.MeshPhysicalMaterial({color:colors.glass,roughness:.2,metalness:.08,transmission:.18,transparent:true,opacity:.88,clearcoat:.65,clearcoatRoughness:.16});
    const litGlassMat=new THREE.MeshPhysicalMaterial({color:colors.glassLit,roughness:.22,metalness:.04,emissive:colors.glassLit,emissiveIntensity:.12,transparent:true,opacity:.94,clearcoat:.7});
    const safetyMat=new THREE.MeshStandardMaterial({color:colors.safety,roughness:.58,metalness:.15});
    const limeMat=new THREE.MeshStandardMaterial({color:colors.lime,roughness:.4,metalness:.05,emissive:colors.lime,emissiveIntensity:.08});

    const ground=addBox(THREE,group,8.8,.12,5.2,0,-.08,0,material(THREE,colors.ground,{roughness:.9}),false,true);
    ground.receiveShadow=true;
    const pad=addBox(THREE,group,4.8,.08,3.6,-.55,.02,0,material(THREE,0x0A7374,{roughness:.86}),false,true);

    const floors=5,floorH=.68,width=3.25,depth=2.18,baseY=.1;
    const completedHeight=baseY+floorH*floors;
    for(let i=0;i<floors;i++){
      const progress=clamp((pct-i*20)/20,0,1);
      if(progress<=.02)continue;
      const h=Math.max(.08,floorH*progress-.045);
      const y=baseY+i*floorH+h/2;
      const floor=addBox(THREE,building,width,h,depth,0,y,0,progress>=.98?facadeMat:slabMat,true,true);
      floor.userData.floor=i+1;
      const slabY=baseY+i*floorH+floorH*progress;
      addBox(THREE,building,width+.12,.065,depth+.12,0,slabY,0,slabMat,true,true);
      const columnHeight=Math.max(.08,h);
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sz])=>addBox(THREE,building,.12,columnHeight,.12,sx*(width/2-.12),y,sz*(depth/2-.12),steelMat,true,true));
      if(progress>=.76){
        const windowMaterial=progress>=.98?glassMat:litGlassMat;
        [-1.05,0,1.05].forEach(x=>addWindow(THREE,building,.0+x,baseY+i*floorH+.34,depth/2+.055,.68,.3,.045,windowMaterial));
        [-1.05,0,1.05].forEach(x=>addWindow(THREE,building,.0+x,baseY+i*floorH+.34,-depth/2-.055,.68,.3,.045,windowMaterial));
        [-.42,.42].forEach(z=>addWindow(THREE,building,width/2+.055,baseY+i*floorH+.34,z,.045,.3,.62,windowMaterial));
      }
      if(i===0){
        addBox(THREE,building,.74,.56,.05,0,baseY+.29,depth/2+.085,glassMat,false,true);
        addBox(THREE,building,.14,.52,.07,0,baseY+.29,depth/2+.11,steelMat,false,true);
      }
    }

    // Open rebar and scaffolding around the unfinished upper floor.
    const scaffold=new THREE.Group();
    const scaffoldHeight=Math.max(1.35,Math.min(completedHeight+.85,baseY+floorH*floors+.9));
    const sy=baseY+.02, sx=width/2+.28, sz=depth/2+.3;
    [[-sx,sz], [sx,sz], [-sx,-sz], [sx,-sz]].forEach(([x,z])=>addRod(THREE,scaffold,new THREE.Vector3(x,sy,z),new THREE.Vector3(x,scaffoldHeight,z),.025,steelMat));
    [0,1,2,3,4,5].forEach(i=>{
      const y=sy+(scaffoldHeight-sy)*(i/5);
      addRod(THREE,scaffold,new THREE.Vector3(-sx,y,sz),new THREE.Vector3(sx,y,sz),.018,steelMat);
      addRod(THREE,scaffold,new THREE.Vector3(-sx,y,-sz),new THREE.Vector3(sx,y,-sz),.018,steelMat);
      addRod(THREE,scaffold,new THREE.Vector3(-sx,y,-sz),new THREE.Vector3(-sx,y,sz),.018,steelMat);
      addRod(THREE,scaffold,new THREE.Vector3(sx,y,-sz),new THREE.Vector3(sx,y,sz),.018,steelMat);
    });
    for(let i=0;i<5;i++){
      const y1=sy+(scaffoldHeight-sy)*(i/5),y2=sy+(scaffoldHeight-sy)*((i+1)/5);
      addRod(THREE,scaffold,new THREE.Vector3(-sx,y1,sz),new THREE.Vector3(sx,y2,sz),.014,steelMat);
      addRod(THREE,scaffold,new THREE.Vector3(sx,y1,sz),new THREE.Vector3(-sx,y2,sz),.014,steelMat);
    }
    group.add(scaffold);

    // Tower crane with a safety-yellow hook and a hanging material load.
    const crane=new THREE.Group();
    const mastX=2.05,mastZ=-.16,mastBase=.05,mastTop=4.55;
    addRod(THREE,crane,new THREE.Vector3(mastX-.18,mastBase,mastZ-.18),new THREE.Vector3(mastX-.18,mastTop,mastZ-.18),.035,steelMat);
    addRod(THREE,crane,new THREE.Vector3(mastX+.18,mastBase,mastZ-.18),new THREE.Vector3(mastX+.18,mastTop,mastZ-.18),.035,steelMat);
    addRod(THREE,crane,new THREE.Vector3(mastX-.18,mastBase,mastZ+.18),new THREE.Vector3(mastX-.18,mastTop,mastZ+.18),.035,steelMat);
    addRod(THREE,crane,new THREE.Vector3(mastX+.18,mastBase,mastZ+.18),new THREE.Vector3(mastX+.18,mastTop,mastZ+.18),.035,steelMat);
    for(let i=0;i<7;i++){
      const y=mastBase+(mastTop-mastBase)*(i/6);
      addRod(THREE,crane,new THREE.Vector3(mastX-.18,y,mastZ-.18),new THREE.Vector3(mastX+.18,y,mastZ+.18),.016,steelMat);
      addRod(THREE,crane,new THREE.Vector3(mastX+.18,y,mastZ-.18),new THREE.Vector3(mastX-.18,y,mastZ+.18),.016,steelMat);
    }
    const armEnd=new THREE.Vector3(-2.35,mastTop+.16,mastZ);
    addRod(THREE,crane,new THREE.Vector3(mastX,mastTop,mastZ),armEnd,.06,safetyMat);
    addRod(THREE,crane,new THREE.Vector3(mastX,mastTop,mastZ),new THREE.Vector3(3.25,mastTop,mastZ),.055,steelMat);
    addBox(THREE,crane,.32,.2,.36,mastX-.35,mastTop+.05,mastZ,steelMat,true,true);
    const trolleyX=-.9;
    addBox(THREE,crane,.23,.14,.24,trolleyX,mastTop+.13,mastZ,steelMat,true,true);
    addRod(THREE,crane,new THREE.Vector3(trolleyX,mastTop+.06,mastZ),new THREE.Vector3(trolleyX,1.65,mastZ),.018,steelMat);
    addBox(THREE,crane,.38,.28,.38,trolleyX,1.48,mastZ,limeMat,true,true);
    group.add(crane);

    const siteLight=new THREE.PointLight(colors.lime,.8,5,2);
    siteLight.position.set(-1.2,4.7,2.2);
    group.add(siteLight);
    group.userData.disposeMaterials=[facadeMat,slabMat,steelMat,glassMat,litGlassMat,safetyMat,limeMat];
    return group;
  }

  function buildTreeModel(THREE,pct){
    const group=new THREE.Group();
    group.position.y=-.28;
    const progress=clamp(Number(pct)||0,0,100)/100;
    const groundMat=material(THREE,0x00343D,{roughness:.92});
    const planterMat=material(THREE,0x0A7374,{roughness:.68,metalness:.12});
    const soilMat=material(THREE,0x4A3020,{roughness:.96});
    const trunkMat=material(THREE,0x6B4930,{roughness:.96});
    const branchMat=material(THREE,0x3B5B36,{roughness:.9});
    const leafMat=new THREE.MeshPhysicalMaterial({color:0xD6FB00,roughness:.72,metalness:.02,clearcoat:.14,clearcoatRoughness:.45});
    const leafDarkMat=new THREE.MeshPhysicalMaterial({color:0x6DBF72,roughness:.78,metalness:.01,clearcoat:.1});
    const fruitMat=new THREE.MeshPhysicalMaterial({color:0xECFFB6,roughness:.28,metalness:.04,emissive:0xD6FB00,emissiveIntensity:.15,clearcoat:.4});
    addBox(THREE,group,8.8,.12,5.2,0,-.08,0,groundMat,false,true);
    addCylinder(THREE,group,1.18,1.02,.58,0,.28,0,planterMat,32,true,true);
    addCylinder(THREE,group,1.02,1.02,.08,0,.62,0,soilMat,32,false,true);
    const tree=new THREE.Group();
    tree.position.y=.62;
    group.add(tree);
    if(progress<.12){
      addSphere(THREE,tree,.16,0,.22,0,fruitMat,true,true);
      addRod(THREE,tree,new THREE.Vector3(-.42,.04,0),new THREE.Vector3(.42,.04,0),.018,branchMat);
    }else{
      const trunkHeight=.34+2.28*Math.min(1,progress/.94);
      const trunk=addCylinder(THREE,tree,.14,.22,trunkHeight,0,trunkHeight/2,0,trunkMat,18,true,true);
      trunk.rotation.z=(progress>.45?-.035:0);
      const top=trunkHeight-.05;
      if(progress>.28){
        addRod(THREE,tree,new THREE.Vector3(0,top*.6,0),new THREE.Vector3(-.82,top+.48,.02),.065,branchMat);
        addRod(THREE,tree,new THREE.Vector3(0,top*.72,0),new THREE.Vector3(.78,top+.62,-.02),.06,branchMat);
      }
      if(progress>.48){
        addRod(THREE,tree,new THREE.Vector3(0,top*.78,0),new THREE.Vector3(-.38,top+.94,.12),.045,branchMat);
        addRod(THREE,tree,new THREE.Vector3(0,top*.86,0),new THREE.Vector3(.3,top+1.05,-.1),.04,branchMat);
      }
      const leaves=Math.max(1,Math.floor(progress*10));
      const leafPositions=[[-.92,top+.58,.02],[-.62,top+.88,.1],[-.22,top+1.12,.12],[.18,top+1.25,-.04],[.58,top+1.02,.02],[.92,top+.72,-.02],[-.55,top+1.32,-.16],[.45,top+1.42,.13],[0,top+1.66,0],[.08,top+.82,.34]];
      leafPositions.slice(0,leaves).forEach(([x,y,z],i)=>{
        const leaf=addSphere(THREE,tree,.3+(i%3)*.035,x,y,z,i%2?leafDarkMat:leafMat,true,true);
        leaf.scale.set(1.18,.82,.92);
      });
      if(progress>.78){
        [[-.62,top+1.1,.22],[.54,top+1.18,.1],[.02,top+1.63,-.18]].slice(0,Math.max(1,Math.floor(progress*3))).forEach(([x,y,z])=>addSphere(THREE,tree,.105,x,y,z,fruitMat,true,true));
      }
    }
    const glow=new THREE.PointLight(0xD6FB00,.75,5,2);
    glow.position.set(1.4,3.8,2.2);
    group.add(glow);
    group.userData.disposeMaterials=[groundMat,planterMat,soilMat,trunkMat,branchMat,leafMat,leafDarkMat,fruitMat];
    return group;
  }

  function buildMoneyModel(THREE,pct){
    const group=new THREE.Group();
    group.position.y=-.3;
    const progress=clamp(Number(pct)||0,0,100)/100;
    const groundMat=material(THREE,0x00343D,{roughness:.9});
    const walletMat=new THREE.MeshPhysicalMaterial({color:0x00545F,roughness:.34,metalness:.28,clearcoat:.45,clearcoatRoughness:.2});
    const walletEdgeMat=material(THREE,0x0A7374,{roughness:.38,metalness:.44});
    const goldMat=new THREE.MeshPhysicalMaterial({color:0xF4C95D,roughness:.24,metalness:.82,clearcoat:.38});
    const glassMat=new THREE.MeshPhysicalMaterial({color:0xECFFB6,roughness:.12,metalness:.02,transmission:.3,transparent:true,opacity:.36,thickness:.3,clearcoat:.7});
    const limeMat=new THREE.MeshPhysicalMaterial({color:0xD6FB00,roughness:.3,metalness:.08,emissive:0xD6FB00,emissiveIntensity:.13,clearcoat:.5});
    addBox(THREE,group,8.8,.12,5.2,0,-.08,0,groundMat,false,true);
    addBox(THREE,group,2.25,.74,.42,-1.3,.72,.18,walletMat,true,true);
    addBox(THREE,group,2.12,.1,.08,-1.3,1.12,.38,walletEdgeMat,true,true);
    addCylinder(THREE,group,.22,.22,.08,-1.3,.74,.42,limeMat,20,false,true).rotation.x=Math.PI/2;
    const jarX=.92;
    addCylinder(THREE,group,.78,.88,1.32,jarX,.72,0,glassMat,32,false,true);
    addCylinder(THREE,group,.82,.82,.08,jarX,1.4,0,walletEdgeMat,32,true,true);
    const coinCount=Math.max(1,Math.floor(progress*12));
    for(let i=0;i<coinCount;i++){
      const row=i%4,layer=Math.floor(i/4);
      addCylinder(THREE,group,.13,.13,.065,jarX+(row-1.5)*.23,.3+layer*.12,(i%2?-.08:.08),goldMat,20,true,true);
    }
    const bars=[.36,.56,.78,1.04,1.28];
    bars.forEach((height,i)=>{
      const filled=Math.max(.12,height*progress);
      addBox(THREE,group,.16,filled,.16,-2.75+i*.34,filled/2+.2,-.2,i===bars.length-1?limeMat:goldMat,true,true);
    });
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.92,.045,12,48),limeMat);
    ring.position.set(jarX,.73,.02);
    ring.rotation.x=Math.PI/2;
    group.add(ring);
    const glow=new THREE.PointLight(0xD6FB00,.9,5,2);
    glow.position.set(.8,2.9,2.3);
    group.add(glow);
    group.userData.disposeMaterials=[groundMat,walletMat,walletEdgeMat,goldMat,glassMat,limeMat];
    return group;
  }

  function buildProgressModel(THREE,pct,visualType){
    if(visualType==="tree")return buildTreeModel(THREE,pct);
    if(visualType==="money")return buildMoneyModel(THREE,pct);
    return buildConstructionModel(THREE,pct);
  }

  function disposeState(state){
    if(!state)return;
    if(state.preview?.endTimer)clearTimeout(state.preview.endTimer);
    if(state.observer)state.observer.disconnect();
    if(state.resizeObserver)state.resizeObserver.disconnect();
    state.scene.traverse(object=>{
      if(object.geometry)object.geometry.dispose();
      if(object.material){
        const materials=Array.isArray(object.material)?object.material:[object.material];
        materials.forEach(mat=>{if(!state.disposedMaterials.has(mat)){state.disposedMaterials.add(mat);mat.dispose();}});
      }
    });
    state.renderer.dispose();
    state.renderer.forceContextLoss?.();
    state.canvas.replaceWith(state.canvas.cloneNode(true));
    states.delete(state);
  }

  function disposeModel(model){
    const disposed=new Set();
    model.traverse(object=>{
      if(object.geometry)object.geometry.dispose();
      if(object.material){
        const materials=Array.isArray(object.material)?object.material:[object.material];
        materials.forEach(mat=>{if(!disposed.has(mat)){disposed.add(mat);mat.dispose();}});
      }
    });
  }

  function replaceModel(state,progress){
    const old=state.model;
    const next=buildProgressModel(window.THREE,progress,state.visualType);
    next.rotation.copy(old.rotation);
    state.scene.remove(old);
    disposeModel(old);
    state.model=next;
    state.scene.add(next);
    state.previewRenderedBucket=Math.floor(progress/5);
  }

  function finishPreview(state){
    if(!state.preview)return;
    if(state.preview.endTimer)clearTimeout(state.preview.endTimer);
    replaceModel(state,state.preview.originalProgress);
    state.preview=null;
    if(state.previewButton){state.previewButton.classList.remove("is-playing");state.previewButton.textContent="▶ ดูขั้นตอน 10 วิ";}
  }

  function resizeState(state){
    const width=Math.max(1,state.canvas.clientWidth||320);
    const height=Math.max(1,state.canvas.clientHeight||176);
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    state.renderer.setSize(width,height,false);
    state.camera.aspect=width/height;
    state.camera.updateProjectionMatrix();
  }

  function attachInteraction(state){
    const canvas=state.canvas;
    const stop=e=>{e.stopPropagation();};
    canvas.addEventListener("pointerdown",e=>{
      stop(e);
      state.dragging=true;
      state.lastX=e.clientX;
      state.lastY=e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      canvas.style.cursor="grabbing";
      scheduleFrame();
    });
    canvas.addEventListener("pointermove",e=>{
      stop(e);
      if(!state.dragging)return;
      const dx=e.clientX-state.lastX;
      const dy=e.clientY-state.lastY;
      state.lastX=e.clientX;
      state.lastY=e.clientY;
      state.model.rotation.y+=dx*.012;
      state.model.rotation.x=clamp(state.model.rotation.x+dy*.006,-.1,.16);
      scheduleFrame();
    });
    ["pointerup","pointercancel","pointerleave"].forEach(type=>canvas.addEventListener(type,e=>{
      stop(e);
      state.dragging=false;
      canvas.style.cursor="grab";
      scheduleFrame();
    }));
    canvas.addEventListener("wheel",e=>{
      stop(e);
      e.preventDefault();
      state.camera.position.z=clamp(state.camera.position.z+e.deltaY*.008,6.2,11.5);
      state.camera.position.x=state.camera.position.z*.82;
      state.camera.lookAt(0,1.65,0);
      scheduleFrame();
    },{passive:false});
    canvas.addEventListener("click",stop);
  }

  function createState(el){
    if(!window.THREE||el.dataset.constructionReady)return;
    const THREE=window.THREE,canvas=el.querySelector(".construction-3d-canvas");
    if(!canvas)return;
    let renderer;
    try{
      renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"high-performance"});
    }catch(e){return;}
    renderer.setClearColor(0x000000,0);
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.08;
    if(THREE.SRGBColorSpace)renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene();
    scene.fog=new THREE.Fog(0x00545F,9,18);
    const camera=new THREE.PerspectiveCamera(29,1,.1,40);
    camera.position.set(7.1,4.7,8.6);
    camera.lookAt(0,1.65,0);
    scene.add(new THREE.HemisphereLight(0xDDF5F0,0x073840,1.35));
    const sun=new THREE.DirectionalLight(0xECFFB6,3.1);
    sun.position.set(-4.5,8,6);
    sun.castShadow=true;
    sun.shadow.mapSize.width=768;
    sun.shadow.mapSize.height=768;
    sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-4;sun.shadow.camera.near=.5;sun.shadow.camera.far=22;
    sun.shadow.bias=-.00035;
    scene.add(sun);scene.add(sun.target);
    const fill=new THREE.DirectionalLight(0x7EE0D6,1.1);
    fill.position.set(5,3,-4);
    scene.add(fill);scene.add(fill.target);
    const visualType=el.dataset.visualType||"building";
    const model=buildProgressModel(THREE,clamp(Number(el.dataset.progress)||0,0,100),visualType);
    model.rotation.y=-.38;
    scene.add(model);
    const state={el,canvas,renderer,scene,camera,model,visualType,dragging:false,lastX:0,lastY:0,visible:true,lastTime:performance.now(),disposedMaterials:new Set(),observer:null,resizeObserver:null};
    state.observer=window.IntersectionObserver?new IntersectionObserver(entries=>{entries.forEach(entry=>{state.visible=entry.isIntersecting;if(state.visible)scheduleFrame();});},{threshold:.01}):null;
    state.observer?.observe(el);
    state.resizeObserver=window.ResizeObserver?new ResizeObserver(()=>{resizeState(state);scheduleFrame();}):null;
    state.resizeObserver?.observe(canvas);
    resizeState(state);
    attachInteraction(state);
    el.dataset.constructionReady="1";
    el.classList.add("is-ready");
    states.add(state);
    scheduleFrame();
  }

  function scheduleFrame(){if(frameId===null)frameId=requestAnimationFrame(renderFrame);}
  function renderFrame(now){
    frameId=null;
    let shouldContinue=false;
    states.forEach(state=>{
      if(!document.documentElement.contains(state.el)){disposeState(state);return;}
      if(!state.visible&&!state.dragging&&!state.preview)return;
      shouldContinue=true;
      const dt=Math.min(.05,Math.max(.001,(now-state.lastTime)/1000));
      state.lastTime=now;
      if(state.preview){
        const elapsed=(now-state.preview.startedAt)/1000;
        const phase=clamp(elapsed/state.preview.duration,0,1);
        const progress=Math.round(phase*100);
        const bucket=Math.floor(progress/5);
        if(bucket!==state.previewRenderedBucket)replaceModel(state,progress);
        if(phase>=1){
          if(!state.preview.finishedAt)state.preview.finishedAt=now;
          if(now-state.preview.finishedAt>700){
            finishPreview(state);
          }
        }
      }
      if(!state.dragging&&!reducedMotion())state.model.rotation.y+=dt*.12;
      state.renderer.render(state.scene,state.camera);
    });
    if(shouldContinue)frameId=requestAnimationFrame(renderFrame);
  }

  function initConstruction3D(){
    states.forEach(state=>{if(!document.documentElement.contains(state.el))disposeState(state);});
    const projectPage=document.getElementById("page-projects");
    if(projectPage&&!projectPage.classList.contains("active"))return;
    if(!window.THREE){loadThree();return;}
    document.querySelectorAll("[data-construction-3d]").forEach(createState);
    scheduleFrame();
  }

  function playConstructionSequence(goalId){
    const state=Array.from(states).find(item=>item.el.dataset.goalId===String(goalId));
    if(!state)return false;
    if(state.preview)return true;
    state.preview={startedAt:performance.now(),duration:10000,originalProgress:clamp(Number(state.el.dataset.progress)||0,0,100),finishedAt:0};
    state.preview.endTimer=setTimeout(()=>finishPreview(state),10850);
    state.previewRenderedBucket=Math.floor(state.preview.originalProgress/5);
    state.previewButton=state.el.querySelector(".construction-sequence-btn");
    if(state.previewButton){state.previewButton.classList.add("is-playing");state.previewButton.textContent="กำลังจำลอง…";}
    state.visible=true;
    scheduleFrame();
    return true;
  }

  function loadThree(){
    if(loaderStarted)return;
    loaderStarted=true;
    const script=document.createElement("script");
    script.src=THREE_SRC;
    script.async=true;
    script.onload=()=>initConstruction3D();
    script.onerror=()=>{
      if(script.dataset.fallbackLoaded){document.documentElement.classList.add("construction-3d-unavailable");return;}
      script.dataset.fallbackLoaded="1";
      script.src=THREE_FALLBACK_SRC;
    };
    document.head.appendChild(script);
  }

  window.initConstruction3D=initConstruction3D;
  window.playConstructionSequence=playConstructionSequence;
  const dash=document.getElementById("projDash");
  if(dash&&window.MutationObserver)new MutationObserver(()=>initConstruction3D()).observe(dash,{childList:true,subtree:true});
  initConstruction3D();
})();
