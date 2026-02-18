# Sign In with Google
by Ethan Goode

## Description
This experiment was to set up an OAuth client in Google cloud, add a "sign in with Google" button to a test website,
 and have the backend perform CSRF verification/Token validation/sub extraction. Running the provided
 experiment yourself will not work, because you must be added as an OAuth test account in Google Cloud.
 
## Results
The Sign in with Google button was surprisingly easy to implement. Most of my time was spent debugging ssl
 issues and Redirect URI naming. This could be done again in less than two hours. I was expecting the OIDC server
 flow described [here](https://developers.google.com/identity/openid-connect/openid-connect), which means I was
 pleasantly surprised when I clicked the "sign-in" and the subject ID was provided immediately (no backend requests
 needed other than verifying Google's signature).
 
## Notes:
 - From my testing, it seems https is a requirement regardless of setting the redirect_URI to http. While this may be
incorrect, the End User kept being redirected to an HTTPS endpoint even with redirect_URI having http. This makes sense,
since the tokens can contain sensitive information and should be encrypted.

 - The OAuth client secret wasn't used anywhere. That is simultaneously relieving because it means I won't
have to store the secret anywhere, as well as concerning because the Client_ID is public and the only thing
stopping someone else from using it are the allowed origins/redirect_URI settings.

 - Verifying the token signature requires javascript's `await/async`. Apparently there is no acceptable way to
bring the result back to a synchronous function. While not positive yet, I have a gut feeling that our services will
involve a lot of `await/async` because of that.

 - I'm currently designing our API / business logic in an unpublished branch. This test was super helpful because I can
eliminate all of the backend OIDC verification endpoints (that would take an access code and convert it to an ID token).
Honestly, I'm not sure how that would have been done in the first place. Maybe it involves the "redirect" option of the
[Sign in with Google HTML generator](https://developers.google.com/identity/gsi/web/tools/configurator)?

 - Node was giving errors regarding missing files in the google-auth-library module. They seem to have no effect on the
module's functionality.

 - An advanced version of this experiment may involve having the `/auth` endpoint sign a token and give it to the End
User before redirecting them to some useful endpoint like `/index`.

 - The provided self-signed certificates are for convenience. In the event that someone does get added as an OAuth test
account: they should be able to download the experiment, compile the typescript, and have it work immediately.
