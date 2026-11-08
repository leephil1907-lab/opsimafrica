"""Create the honest, captioned 60-second product walkthrough from captured app views.
Optional build-time tools: Pillow and imageio-ffmpeg. No runtime dependency.
Run the labelled product-evidence browser test first. Output contains NO headset footage.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import subprocess
import json
ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / '.cache' / 'demo-frames'
FRAMES.mkdir(parents=True, exist_ok=True)
ASSETS = ROOT / 'public' / 'images'
FONT = ROOT / 'public' / 'fonts' / 'manrope-variable.ttf'
NAVY = '#0F1B2A'
GREEN = '#007E53'
def font(size, weight=600):
    f = ImageFont.truetype(str(FONT), size)
    try:
        f.set_variation_by_axes([weight])
    except (AttributeError, OSError):
        pass
    return f

def wrapped(draw, text, xy, width, size=24, fill=NAVY, weight=500, leading=1.55):
    f=font(size,weight)
    y=xy[1]
    for para in text.split('\n'):
        line=''
        for word in para.split():
            if draw.textlength((line+' '+word).strip(),font=f)>width and line:
                draw.text((xy[0],y),line,font=f,fill=fill)
                y+=int(size*leading)
                line=word
            else:
                line=(line+' '+word).strip()
        if line:
            draw.text((xy[0],y),line,font=f,fill=fill)
            y+=int(size*leading)
    return y

scenes=[
    ('Before the\ncostly mistake.', 'Give staff a safe place to practise real receiving decisions.', 'retail-practice-hero.webp', 'Illustrative training scene · fictional trainee', None),
    ('Know the task.\nCheck the evidence.', 'Read the delivery note. Receive eight cartons at BrightMart Mini Store.', 'product-stockroom.png', 'Actual desktop product screenshot', None),
    ('Inspect before\nyou accept.', 'Check packaging, product labels, batch and expiry. Isolate damaged, expired or mismatched physical stock.', 'product-inspect.png', 'Crop of actual desktop inspector', 'top'),
    ('Count what\nactually arrived.', 'Expected 24. Actual 22. Accept 22 sound units and record a shortage of 2. Missing units are not quarantine stock.', 'product-record.png', 'Crop of actual receiving tablet', 'top'),
    ('Review.\nThen confirm.', 'Reconcile each receiving line. Keep shortages and overages separate. Explicit confirmation saves the report.', 'product-review.png', 'Crop of actual receiving report', 'bottom'),
    ('A score.\nA next step.', 'Review accuracy, exceptions, process and efficiency. Get two coaching priorities. Repeat the lesson or try a harder delivery.', 'product-scorecard.png', 'Crop of actual saved scorecard', 'top'),
]
steps=['Brief','Receive','Inspect','Record','Review','Improve']
for i,(title,body,source,label,crop) in enumerate(scenes):
    canvas=Image.new('RGB',(1280,720),'#F6F7F9')
    d=ImageDraw.Draw(canvas)
    d.rounded_rectangle((48,38,92,82),radius=12,fill=NAVY)
    d.line([(59,55),(70,49),(81,55),(81,69),(70,76),(59,69),(59,55),(70,61),(81,55)],fill='#E8EDF2',width=2)
    d.line([(73,70),(78,75),(88,62)],fill='#00A86B',width=3)
    d.text((106,40),'OpsSim Africa',font=font(24,800),fill=NAVY)
    d.text((107,72),'REAL WORK. REHEARSED.',font=font(11,750),fill='#536174')
    d.rounded_rectangle((48,139,233,171),radius=6,fill='#E4F1E9')
    d.text((60,147),f'BRIGHTMART / {i+1:02d}',font=font(12,750),fill=GREEN)
    y=wrapped(d,title,(48,194),385,size=42,weight=800,leading=1.18)
    wrapped(d,body,(50,y+27),370,size=23,fill='#4B6073',weight=500,leading=1.6)
    if i==5:
        d.rounded_rectangle((49,561,368,613),radius=9,fill=NAVY)
        d.text((70,574),'Try the practice lab  →',font=font(18,750),fill='#FFFFFF')
    d.rounded_rectangle((451,124,1233,619),radius=18,fill='#E5EDF0',outline='#D2DEE4',width=1)
    im=Image.open(ASSETS/source).convert('RGB')
    if crop:
        height=min(im.height,640 if i==2 else 600 if i==3 else 650)
        top=max(0,im.height-height) if crop=='bottom' else 0
        im=im.crop((0,top,im.width,top+height))
    if i==0:
        im=ImageOps.fit(im,(738,446),method=Image.Resampling.LANCZOS)
    else:
        # Capture crops are only resized; their original values are never repainted.
        im=ImageOps.contain(im,(738,446),method=Image.Resampling.LANCZOS)
    x=451+(782-im.width)//2
    yy=124+(469-im.height)//2
    canvas.paste(im,(x,yy))
    d.text((474,592),label,font=font(12,650),fill='#455E70')
    for j,name in enumerate(steps):
        x=48+j*198
        d.rounded_rectangle((x,650,x+178,654),radius=2,fill='#00A86B' if j<=i else '#D5DEE5')
        d.text((x,663),name,font=font(12,750 if i==j else 500),fill=GREEN if i==j else '#5B6F81')
    d.text((48,703),'Captioned product walkthrough · desktop screenshots + illustrative opening · not physical Quest footage',font=font(9,600),fill='#5B6F81',anchor='ls')
    canvas.save(FRAMES/f'{i+1}.png')

try:
    import imageio_ffmpeg
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    ffmpeg='ffmpeg'
cmd=[ffmpeg,'-y','-hide_banner','-loglevel','warning','-filter_complex_threads','1']
for i in range(6):
    cmd+=['-loop','1','-framerate','24','-t','10.4' if i<5 else '10','-i',str(FRAMES/f'{i+1}.png')]
filters=[f'[{i}:v]format=yuv420p,setsar=1[v{i}]' for i in range(6)]
prev='v0'
for i in range(1,6):
    out=f'blend{i}'
    filters.append(f'[{prev}][v{i}]xfade=transition=fade:duration=0.4:offset={i*10}[{out}]')
    prev=out
cmd+=['-filter_complex',';'.join(filters),'-map',f'[{prev}]','-t','60','-r','24','-an','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart','-metadata','title=OpsSim Africa — 60-second product walkthrough','-metadata','comment=Actual desktop screenshots and an illustrative opening. No physical Quest footage.',str(ASSETS/'product-demo.mp4')]
subprocess.run(cmd,check=True)
lines=['WEBVTT','']
for i,(title,body,*_) in enumerate(scenes):
    lines += [f'{i+1}',f'00:00:{i*10:02d}.000 --> 00:{(i+1)*10//60:02d}:{(i+1)*10%60:02d}.000',title.replace('\n',' ')+' '+body,'']
(ASSETS/'product-demo.vtt').write_text('\n'.join(lines))
meta={'durationSeconds':60,'framesPerSecond':24,'resolution':[1280,720],'audio':'none; captioned','source':'Actual desktop screenshots captured by the product evidence Playwright test; illustrative AI-generated opening scene.','physicalHeadsetFootage':False,'chapters':[{'from':i*10,'to':(i+1)*10,'title':s[0].replace('\n',' '),'asset':s[2]}for i,s in enumerate(scenes)]}
(ROOT/'docs'/'PRODUCT-DEMO.json').write_text(json.dumps(meta,indent=2)+'\n')
print('Created',ASSETS/'product-demo.mp4',(ASSETS/'product-demo.mp4').stat().st_size,'bytes; 60 seconds, captioned, no headset-footage claim.')
