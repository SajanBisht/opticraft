const API_KEY = "AIzaSyCeyUFl2PqNyszvAKnbcewWfdr-s_fyV-E";

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`
);

const data = await res.text();

console.log(data);