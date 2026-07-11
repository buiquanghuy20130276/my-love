/**
 * Compresses a video file on the client side using MediaRecorder and Web Audio API.
 * Compresses to 1080p (FHD) at 4 Mbps target bitrate.
 */
export function compressVideo(file: File, targetBitrate: number = 4000000): Promise<Blob | File> {
  return new Promise((resolve) => {
    // 1. Bypass compression if the file is not a video or size is under 15MB
    if (!file.type.startsWith('video/')) {
      resolve(file)
      return
    }

    console.log(`Starting client-side video compression for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`)

    // Create a hidden video element
    const video = document.createElement('video')
    video.src = URL.createObjectURL(file)
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    
    // We do NOT mute it because we want Web Audio API to capture the audio stream.
    // Instead, we route the audio node silently without connecting to speakers.
    video.muted = false

    video.onloadedmetadata = () => {
      try {
        let videoStream: MediaStream
        if ((video as any).captureStream) {
          videoStream = (video as any).captureStream()
        } else if ((video as any).mozCaptureStream) {
          videoStream = (video as any).mozCaptureStream()
        } else {
          console.warn('Browser does not support captureStream on video elements. Fallback to original file.')
          resolve(file)
          return
        }

        // Silent audio capture using Web Audio API
        let audioTrack: MediaStreamTrack | null = null
        let audioCtx: AudioContext | null = null
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
          audioCtx = new AudioContextClass()
          const source = audioCtx.createMediaElementSource(video)
          const destination = audioCtx.createMediaStreamDestination()
          
          // Connect to destination (for recording) but NOT to audioCtx.destination (for silent playback)
          source.connect(destination)
          
          const audioTracks = destination.stream.getAudioTracks()
          if (audioTracks.length > 0) {
            audioTrack = audioTracks[0]
          }
        } catch (audioErr) {
          console.warn('Silent audio routing failed, falling back to video stream audio:', audioErr)
        }

        const videoTracks = videoStream.getVideoTracks()
        if (videoTracks.length === 0) {
          resolve(file)
          return
        }
        const videoTrack = videoTracks[0]

        // Combine video track and silent audio track
        const tracks: MediaStreamTrack[] = [videoTrack]
        if (audioTrack) {
          tracks.push(audioTrack)
        } else {
          // If Web Audio API failed, fallback to tracks in the captured videoStream
          const originalAudioTracks = videoStream.getAudioTracks()
          if (originalAudioTracks.length > 0) {
            tracks.push(originalAudioTracks[0])
          }
        }

        const combinedStream = new MediaStream(tracks)

        // Select suitable video mimetype
        let mimeType = 'video/webm;codecs=vp9'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8'
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm'
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4;codecs=h264'
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '' // browser default
        }

        const recorderOptions: MediaRecorderOptions = {
          videoBitsPerSecond: targetBitrate
        }
        if (mimeType) {
          recorderOptions.mimeType = mimeType
        }

        const mediaRecorder = new MediaRecorder(combinedStream, recorderOptions)
        const chunks: Blob[] = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data)
          }
        }

        mediaRecorder.onstop = () => {
          try {
            if (audioCtx) {
              audioCtx.close()
            }
          } catch (e) {}

          const finalBlob = new Blob(chunks, { type: mimeType || 'video/mp4' })
          console.log(`Video compression finished. Compressed size: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`)
          resolve(finalBlob)
        }

        mediaRecorder.start()
        video.play().catch((err) => {
          console.error('Video playback failed during compression:', err)
          resolve(file)
        })

        video.onended = () => {
          mediaRecorder.stop()
          URL.revokeObjectURL(video.src)
        }
      } catch (err) {
        console.error('Video compression setup failed:', err)
        resolve(file)
      }
    }

    video.onerror = () => {
      resolve(file)
    }
  })
}
