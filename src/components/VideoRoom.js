import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './VideoRoom.css';

const socket = io('http://localhost:5000');

const VideoRoom = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    socket.on('offer', async (offer) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socket.emit('answer', { roomId, answer });
    });

    socket.on('answer', async (answer) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async (candidate) => {
      if (!peerConnectionRef.current) return;
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding received ICE candidate', err);
      }
    });
  }, [roomId]);

  const joinRoom = async () => {
    setJoined(true);

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;

    peerConnectionRef.current = new RTCPeerConnection();
    stream.getTracks().forEach((track) => {
      peerConnectionRef.current.addTrack(track, stream);
    });

    peerConnectionRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { roomId, candidate: event.candidate });
      }
    };

    socket.emit('join-room', roomId);
  };

  const startCall = async () => {
    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    socket.emit('offer', { roomId, offer });
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      const sender = peerConnectionRef.current
        .getSenders()
        .find((s) => s.track.kind === 'video');

      if (sender) {
        sender.replaceTrack(screenTrack);
        localVideoRef.current.srcObject = screenStream;

        screenTrack.onended = async () => {
          const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const cameraTrack = cameraStream.getVideoTracks()[0];
          sender.replaceTrack(cameraTrack);
          localVideoRef.current.srcObject = cameraStream;
        };
      }
    } catch (err) {
      console.error('Screen sharing error:', err);
    }
  };

  return (
    <div className="container">
      <h3>Join Video Room</h3>

      {!joined ? (
        <div>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <br />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      ) : (
        <div>
          <div className="video-wrapper">
            <video ref={localVideoRef} autoPlay muted />
            <video ref={remoteVideoRef} autoPlay />
          </div>
          <button onClick={startCall}>Start Call</button>
          <button onClick={startScreenShare} style={{ marginLeft: '10px' }}>Share Screen</button>
        </div>
      )}
    </div>
  );
};

export default VideoRoom;
