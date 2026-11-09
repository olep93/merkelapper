// EAN encoding tables. Bars are drawn directly as vectors at X=0.33mm.
const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const G = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];
const parity = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];
export function eanBits(ean: string) {
  const R = (d: string) =>
    L[Number(d)].replace(/[01]/g, (c) => (c === "0" ? "1" : "0"));
  if (ean.length === 8)
    return (
      "101" +
      [...ean.slice(0, 4)].map((d) => L[+d]).join("") +
      "01010" +
      [...ean.slice(4)].map(R).join("") +
      "101"
    );
  return (
    "101" +
    [...ean.slice(1, 7)]
      .map((d, i) => (parity[+ean[0]][i] === "L" ? L : G)[+d])
      .join("") +
    "01010" +
    [...ean.slice(7)].map(R).join("") +
    "101"
  );
}
