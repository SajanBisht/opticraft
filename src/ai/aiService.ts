export async function generateAIComment(functionCode: string, meta: any) {
  const res = await fetch("http://localhost:5000/generate-comment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: functionCode,
      metadata: meta,
    }),
  });

  const data = await res.json();
  return data.comment;
}