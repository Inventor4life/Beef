import { useEffect, useRef, useState } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function App() {
  const btnRef = useRef(null);
  const [status] = useState("Not signed in");

  useEffect(() => {
    if (!CLIENT_ID) return;

    const initAndRender = () => {
      if (!window.google?.accounts?.id) return;

      // This is the key part that matches your original server POST flow:
      // Google will POST credential + g_csrf_token to /auth
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        ux_mode: "redirect",
        login_uri: `${window.location.origin}/auth`,
      });

      if (btnRef.current) {
        btnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(btnRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
        });
      }
    };

    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existing) {
      if (window.google?.accounts?.id) initAndRender();
      else existing.addEventListener("load", initAndRender, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", initAndRender, { once: true });
    document.body.appendChild(script);
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 800, margin: "0 auto" }}>
      <h1>Beef</h1>

      <h3>Google Sign-In</h3>
      <div ref={btnRef} />

      <p style={{ marginTop: 12 }}>
        <strong>Status:</strong> {status}
      </p>
    </main>
  );
}
