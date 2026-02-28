## Generating x509 certificates
# Windows
Private keys are generated with the command `openssl ecparam -genkey -name prime256v1 -out <your-key-name>.key`.

Self signed certificates are generated with the command `openssl req -x509 -new -sha256 -key <your-key-name>.key -days 365 -out <your-cert-name>.crt`.
For convenience, please give the certificate the same name as the key used to generate it.

All of the default options when creating the certificates are fine except for the Common Name. It should be localhost for
 development certificates, or the IP of the production vm for production certificates. It may be necessary to create
 IP-based development certificates at some point, so the certificate details are listed below in [Dev Certificates](#dev-certificates). Certificate details can
 be found using `openssl x509 -in <your-cert-name>.crt -text -noout`

# Linux
This method has not been tested on linux. However, `openssl` is available on linux so the same (or similar) commands should work.

## Dev Certificates
|Certificate Name| Common Name |
|----------------|-------------|
