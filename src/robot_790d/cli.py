import os
import json
import argparse

from robot_790d.behavior import BehaviorDaemon
from robot_790d.devices.esp32_face import DEFAULT_FACE_URL, Esp32FaceClient, FaceSettings
from robot_790d.state import Affect, RobotMode


def main() -> None:
    parser = argparse.ArgumentParser(prog="robot-790d")
    parser.add_argument("--face-url", default=os.getenv("ROBOT_790_FACE_URL", DEFAULT_FACE_URL))
    parser.add_argument("--timeout", type=float, default=float(os.getenv("ROBOT_790_FACE_TIMEOUT_S", "0.8")))
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("state")
    subparsers.add_parser("idle")
    subparsers.add_parser("listen")
    subparsers.add_parser("think")
    subparsers.add_parser("sleep")

    speak = subparsers.add_parser("speak")
    speak.add_argument("--energy", type=float, default=0.55)

    beat = subparsers.add_parser("beat")
    beat.add_argument("name")

    args = parser.parse_args()
    face = Esp32FaceClient(FaceSettings(base_url=args.face_url, timeout_s=args.timeout))
    daemon = BehaviorDaemon(face)
    try:
        if args.command == "state":
            result = face.state()
        elif args.command == "idle":
            result = daemon.set_mode(RobotMode.IDLE)
        elif args.command == "listen":
            result = daemon.set_mode(RobotMode.LISTENING)
        elif args.command == "think":
            result = daemon.set_mode(RobotMode.THINKING)
        elif args.command == "speak":
            result = daemon.set_mode(RobotMode.SPEAKING, Affect(energy=args.energy))
        elif args.command == "sleep":
            result = daemon.set_mode(RobotMode.SLEEPING)
        elif args.command == "beat":
            result = daemon.play_beat(args.name)
        else:
            result = {"error": f"unknown command: {args.command}"}
    finally:
        face.close()
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

