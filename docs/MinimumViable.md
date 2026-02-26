# Minimum Viable Product

**Goal:** Users can log in and send messages (no custom usernames, channels, or guilds). In place of usernames, the real names received from Google (during sign in) will be used.

## Flow

The User will connect to our root directory (not sure what the IP/Name will be, but express will call the `app.get('/', ...` function on the backend.

The frontend will check if a user is logged in (see below) and present the **Log In With Google** button if they are not. If they are logged in, it should present a chat window with all previous messages in the server and a text input bar / send button so users can create new messages.

## Logging a User In

When a user clicks the log in button, they are sent to a sign-in page before being redirected to the `/auth` endpoint via POST. This is done automatically and needs no configuration from us. The code in [experiments/multi_service_sign_in/src/auth.ts](https://github.com/Inventor4life/Beef/blob/main/experiments/multi_service_sign_in/src/auth.ts) (lines 20–36 and 60–98) receives the user's log-in request, verifies that they successfully logged in with Google, and then issues them a custom JWT that is checked in future sections.

The user is redirected to the `/index` endpoint regardless of whether the sign in was successful or not. We may change this back to the root if needed, or have the root redirect to `/index`. Also, the current token duration is 1 minute. This should be expanded to a more useful duration (such as 10 or 15 minutes).

## Checking if a User Has Logged In

During user log-in, the auth section of our service issues a JSON Web Token to them. Whenever a user reconnects to our website, we can verify that they have a valid JWT using the code found in [experiments/multi_service_sign_in/src/presenter.ts](https://github.com/Inventor4life/Beef/blob/main/experiments/multi_service_sign_in/src/presenter.ts) (lines 14–21 and 30–48). This code additionally presents a login page if they are not logged in, or presents a welcome page if they are.

As of right now, the frontend has no way of knowing what the user's display name is. It won't need to for this MVP (see Receiving/Sending Messages).

## Receiving Existing Messages

Once the user has logged in (and every 2 seconds afterward — or whatever interval we choose), the frontend should send a `GET /messages` request. The user's browser appends the JWT they received in the "Logging a User In" section automatically (requires no configuration from us). The backend will return a JSON list of messages.

Messages will have the following structure:

```json
{
  "author": "string",
  "id": "number",
  "content": "string"
}
```

The frontend should check what messages are already being displayed to the user and only add new messages into the chat. The backend should check that the user has a valid JWT (same code as before) and should return an error status (via HTTP status codes) if not. If the user presents a valid JWT, the backend should query the database for **all** messages and return them to the user in the format above (we will add getting only certain messages in future versions). If the frontend receives a not-logged-in error status, it should redirect the user to the log-in page.

## Sending New Messages

When the user types in a message and clicks send, the frontend should convert that to the template above (without the ID) and send it via `POST /messages` (with the message JSON in the body). The backend will verify the user is logged in and return the same message structure (with ID) in the response body if so. If not, the backend should return the earlier error code.

The frontend (if no error codes are returned) should use the returned message JSON to display the message in the chat history rather than taking it directly from the user. This ensures that the user only sees their own message appear after it has been received by a server without waiting for the next `GET` request, and also ensures that errors will not leave the user wondering if their message was sent.

When a message is received by the backend, it should write it to the database (rather than having the service store it directly). Our initial IDs will not be snowflakes; they will be issued incrementally (1, 2, 3…) for this MVP. On startup, the backend should query the database for the ID of the last stored message, store that in an internal variable, and issue/increment the ID for every future message.