#!/usr/bin/env python3
import http.server
import ssl
import socketserver
import os

# Change to the directory containing the files
os.chdir('/Users/bryanyaupwh/mobile-photo-1')

# Create HTTPS server
PORT = 8443
Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    # Create SSL context
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain('cert.pem', 'key.pem')
    
    # Wrap the socket with SSL
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    
    print(f"HTTPS Server running on port {PORT}")
    print(f"Access at: https://localhost:{PORT}")
    print("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        httpd.shutdown()
