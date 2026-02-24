function App() {
  const session = {
    title: "Beef", //determines the large title text, this will be program name
    description:
      "React test page, needs to connect to our backend and implement the OIDC.",
    slides: [],
  };

  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1>{session.title}</h1>

      <p>{session.description}</p>

      <h3> Additional features logo? etc... </h3>
      <ul>
        {session.slides.map((slide) => (
          <li key={slide.id} style={{ marginBottom: "10px" }}>
            <strong>{slide.title}</strong>
            <div>{slide.summary}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
