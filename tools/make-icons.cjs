// Genera los íconos de Android (legacy + adaptativos) renderizando un canvas con Playwright.
// Uso: node tools/make-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const res = path.join(root, 'android/app/src/main/res');
const fontUrl = 'file://' + path.join(root, 'web/fonts/CinzelDecorative-700.woff2');

const page = `<!doctype html><html><head><style>
@font-face{font-family:CD;font-weight:700;src:url(${fontUrl})}
body{margin:0;background:transparent}</style></head><body><canvas id=c></canvas><script>
function rnd(s){return function(){s=(s*16807)%2147483647;return (s-1)/2147483646}}
window.draw=function(size,mode){
  const c=document.getElementById('c');c.width=c.height=size;const g=c.getContext('2d');
  g.clearRect(0,0,size,size);
  const r=rnd(7);
  const bg=()=>{
    const gr=g.createRadialGradient(size*.5,size*.35,0,size*.5,size*.5,size*.75);
    gr.addColorStop(0,'#3a2258');gr.addColorStop(.55,'#160c26');gr.addColorStop(1,'#050208');
    g.fillStyle=gr;g.fillRect(0,0,size,size);
    g.strokeStyle='rgba(200,195,240,.22)';g.lineWidth=Math.max(1,size/160);
    for(let i=0;i<40;i++){const x=r()*size*1.2,y=r()*size,l=size*(.04+r()*.06);g.beginPath();g.moveTo(x,y);g.lineTo(x-l*.25,y+l);g.stroke();}
  };
  const fg=(scale)=>{
    const fs=size*.42*scale;const font='700 '+fs+'px CD';g.font=font;
    const w=g.measureText('R').width;const cx=size/2,by=size/2+fs*.33;
    const layer=(mirror,c0,c1)=>{
      const tmp=document.createElement('canvas');tmp.width=tmp.height=size;const t=tmp.getContext('2d');
      t.font=font;t.textBaseline='alphabetic';t.fillStyle='#fff';
      if(mirror){t.save();t.translate(cx+w*0.1,0);t.scale(-1,1);t.fillText('R',0,by);t.restore();}
      else{
        t.fillText('R',cx-w*0.1,by);
        const drip=(x,len,wd)=>{t.beginPath();t.moveTo(x-wd,by-wd*.6);t.lineTo(x-wd*.4,by+len);t.arc(x,by+len,wd*.55,Math.PI,0,true);t.lineTo(x+wd,by-wd*.6);t.fill();};
        drip(cx+w*.05,fs*.34,fs*.04);drip(cx+w*.75,fs*.18,fs*.032);drip(cx-w*.02,fs*.12,fs*.03);
      }
      t.globalCompositeOperation='source-in';
      const gr=t.createLinearGradient(0,by-fs*.8,0,by+fs*.35);gr.addColorStop(0,c0);gr.addColorStop(1,c1);
      t.fillStyle=gr;t.fillRect(0,0,size,size);return tmp;
    };
    const back=layer(true,'#8a0a08','#3a0000'),front=layer(false,'#ff3a24','#6a0000');
    const tmp=document.createElement('canvas');tmp.width=tmp.height=size;const t=tmp.getContext('2d');
    t.drawImage(back,0,0);t.drawImage(front,0,0);
    g.save();g.filter='blur('+(size*.04)+'px)';g.globalAlpha=.9;g.drawImage(tmp,0,0);g.restore();
    g.drawImage(tmp,0,0);
  };
  if(mode==='legacy'){bg();fg(1);}
  else if(mode==='round'){g.save();g.beginPath();g.arc(size/2,size/2,size/2,0,7);g.clip();bg();fg(.95);g.restore();}
  else if(mode==='bg'){bg();}
  else if(mode==='fg'){fg(.62);}
  return c.toDataURL('image/png');
};
</script></body></html>`;

const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const tmp = path.join(require('os').tmpdir(), 'redmain-icons.html');
  fs.writeFileSync(tmp, page);
  await p.goto('file://' + tmp);
  await p.evaluate(() => document.fonts.load('700 40px CD'));
  const save = async (file, size, mode) => {
    const url = await p.evaluate(([s, m]) => window.draw(s, m), [size, mode]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  };
  for (const [d, k] of Object.entries(dens)) {
    const dir = path.join(res, 'mipmap-' + d);
    await save(path.join(dir, 'ic_launcher.png'), Math.round(48 * k), 'legacy');
    await save(path.join(dir, 'ic_launcher_round.png'), Math.round(48 * k), 'round');
    await save(path.join(dir, 'ic_launcher_bg.png'), Math.round(108 * k), 'bg');
    await save(path.join(dir, 'ic_launcher_fg.png'), Math.round(108 * k), 'fg');
  }
  await save(path.join(root, 'docs/icon-512.png'), 512, 'legacy');
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
    '    <background android:drawable="@mipmap/ic_launcher_bg" />\n    <foreground android:drawable="@mipmap/ic_launcher_fg" />\n</adaptive-icon>\n';
  const any = path.join(res, 'mipmap-anydpi-v26');
  fs.mkdirSync(any, { recursive: true });
  fs.writeFileSync(path.join(any, 'ic_launcher.xml'), xml);
  fs.writeFileSync(path.join(any, 'ic_launcher_round.xml'), xml);
  await b.close();
  console.log('íconos generados en', res);
})();
