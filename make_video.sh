#!/bin/bash
cd /workspace

# Каждое фото — 4 секунды, fade in/out, текст поздравления
# Финальный размер 1080x1920 (вертикальный)

ffmpeg -y \
  -loop 1 -t 5 -i slide1.jpg \
  -loop 1 -t 5 -i slide2.jpg \
  -loop 1 -t 5 -i slide3.jpg \
  -loop 1 -t 5 -i slide4.jpg \
  -filter_complex "
    [0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,
      fade=t=in:st=0:d=1,fade=t=out:st=4:d=1[v0];
    [1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,
      fade=t=in:st=0:d=1,fade=t=out:st=4:d=1[v1];
    [2:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,
      fade=t=in:st=0:d=1,fade=t=out:st=4:d=1[v2];
    [3:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,
      fade=t=in:st=0:d=1,fade=t=out:st=4:d=1,
      drawtext=text='С 8 марта\, Ли ❤️':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=h-200:
        shadowcolor=black:shadowx=2:shadowy=2:
        enable='between(t,1,4)':alpha='if(lt(t,2),t-1,if(gt(t,3.5),4-t,1))'[v3];
    [v0][v1][v2][v3]concat=n=4:v=1:a=0[out]
  " \
  -map "[out]" \
  -c:v libx264 -pix_fmt yuv420p -r 25 \
  output_li.mp4

echo "DONE"
