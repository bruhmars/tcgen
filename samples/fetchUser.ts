export interface User {
  id: number;
  name: string;
  email: string;
}

export async function fetchUser(id: number): Promise<User> {
  if (id <= 0) throw new Error("ID must be positive");
  const res = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}
