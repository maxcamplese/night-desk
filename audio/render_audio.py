#!/usr/bin/env python3
"""
render_audio.py: Turn a folder of cleaned .txt readings into tagged .m4a
audiobook files with the Piper text-to-speech engine, which runs offline.

Usage:
  python3 -m venv .venv && .venv/bin/pip install piper-tts mutagen
  .venv/bin/python -m piper.download_voices en_US-lessac-medium
  .venv/bin/python audio/render_audio.py --texts texts/ --out audio-out/ \
      --model en_US-lessac-medium.onnx --album "HIS 101 readings"

Files that already exist are skipped, so an interrupted run can be resumed.
Set FORCE_RERENDER=1 to redo them. Conversion to .m4a uses macOS afconvert,
or ffmpeg if afconvert is not available.

Exit codes: 0 = all files rendered or skipped, 1 = at least one failed, 2 = bad usage.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor


def to_m4a(wav, m4a):
    if shutil.which("afconvert"):
        cmd = ["afconvert", "-f", "m4af", "-d", "aac", wav, m4a]
    elif shutil.which("ffmpeg"):
        cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", "64k", m4a]
    else:
        raise RuntimeError("need afconvert (macOS) or ffmpeg to make .m4a files")
    subprocess.run(cmd, check=True, capture_output=True, timeout=1800)


def tag(m4a, title, album):
    try:
        from mutagen.mp4 import MP4
    except ImportError:
        return  # tags are a nicety; the audio is fine without them
    tags = MP4(m4a)
    tags["\xa9nam"] = title
    tags["\xa9alb"] = album
    tags["\xa9ART"] = "Night Desk"
    tags["\xa9gen"] = "Audiobook"
    tags.save()


def render(job, args):
    title = os.path.splitext(os.path.basename(job))[0]
    m4a = os.path.join(args.out, title + ".m4a")
    if os.environ.get("FORCE_RERENDER") != "1" and os.path.exists(m4a) and os.path.getsize(m4a) > 10000:
        return "skip", title
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "out.wav")
        try:
            start = time.time()
            subprocess.run([sys.executable, "-m", "piper", "-m", args.model,
                            "--length-scale", str(args.length_scale),
                            "--sentence-silence", str(args.sentence_silence),
                            "-i", job, "-f", wav],
                           check=True, capture_output=True, timeout=7200)
            partial = m4a + ".partial.m4a"
            to_m4a(wav, partial)
            tag(partial, title, args.album)
            os.replace(partial, m4a)  # only a finished file gets the real name
            print(f"done  {title} ({time.time() - start:.0f}s)", flush=True)
            return "done", title
        except subprocess.CalledProcessError as error:
            # Show the tool's own last error line; the exit status alone says nothing.
            detail = (error.stderr or b"").decode(errors="replace").strip().splitlines()
            print(f"FAIL  {title}: {detail[-1] if detail else error}", flush=True)
            return "fail", title
        except (subprocess.SubprocessError, OSError, RuntimeError) as error:
            print(f"FAIL  {title}: {error}", flush=True)
            return "fail", title


def warn_long_install_path():
    """
    espeak-ng (which Piper uses for pronunciation) stores its data path in a
    fixed-size buffer. A long install path is cut off and every render fails
    with "Error processing file .../phontab". Catch that before rendering.
    """
    try:
        import piper
    except ImportError:
        return
    data = os.path.join(os.path.dirname(piper.__file__), "espeak-ng-data")
    if len(data) > 150:
        print(f"Warning: Piper is installed under a long path ({len(data)} characters). "
              "If renders fail with a 'phontab' error, create the virtual environment "
              "in a shorter folder, such as .venv inside this repo.", file=sys.stderr)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Render .txt readings to .m4a with Piper.")
    parser.add_argument("--texts", required=True, help="folder of .txt files")
    parser.add_argument("--out", required=True, help="folder for .m4a files")
    parser.add_argument("--model", required=True, help="Piper voice .onnx file")
    parser.add_argument("--album", default="Night Desk readings")
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--length-scale", type=float, default=0.85, help="below 1 reads faster")
    parser.add_argument("--sentence-silence", type=float, default=0.25, help="seconds between sentences")
    args = parser.parse_args(argv)

    warn_long_install_path()
    if not os.path.isfile(args.model):
        print(f"Voice model not found: {args.model}", file=sys.stderr)
        return 2
    jobs = sorted(os.path.join(args.texts, f) for f in os.listdir(args.texts) if f.endswith(".txt"))
    if not jobs:
        print(f"No .txt files in {args.texts}", file=sys.stderr)
        return 2
    os.makedirs(args.out, exist_ok=True)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(lambda j: render(j, args), jobs))
    counts = {s: sum(1 for r, _ in results if r == s) for s in ("done", "skip", "fail")}
    print(f"\n{counts['done']} rendered, {counts['skip']} skipped, {counts['fail']} failed")
    return 1 if counts["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())
