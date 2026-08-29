import React, { useEffect, useRef } from 'react';

/**
 * Reliable web <video> renderer for WebRTC streams.
 *
 * Assigning `srcObject` is done in an effect keyed to the stream, so it
 * always runs whenever the stream is available (including the mount where
 * the stream was already set before the element existed). Using a private
 * internal ref avoids ref-collision bugs that occur when multiple tiles
 * share a single ref object.
 */
const WebVideo = ({ stream, muted = false, style, playsInline = true, autoPlay = true }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (stream) {
      el.srcObject = stream;
      el.play().catch(e => console.log('WebVideo play error:', e));
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      style={style}
      muted={muted}
      playsInline={playsInline}
      autoPlay={autoPlay}
      disablePictureInPicture
    />
  );
};

export default WebVideo;
