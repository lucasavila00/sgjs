python3.11 -m sglang.launch_server --model-path $(cat /model_path.json | jq -r '.model_path') --port 30000