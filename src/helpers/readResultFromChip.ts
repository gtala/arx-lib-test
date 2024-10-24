export const readTheCorrectPublicKey =  (
  publicKeyDigest: string,
  signatureDigest: string
) => {
  let pkey = Array.from(Buffer.from(publicKeyDigest, "hex"));
  pkey.shift();
  pkey = pkey.slice(0, 32);
  //depends on last byte, unshift 2 or 3 to sub with last number to be even
  if (pkey[pkey.length - 1] % 2 == 0) {
   // pkey.unshift(2); //original way
    pkey.unshift(3);
  } else {
    //pkey.unshift(3); //original way
    pkey.unshift(2);
  }
  const pkey_final = Uint8Array.from(pkey);
  const signature_final = Uint8Array.from(Buffer.from(signatureDigest, "hex"));
  return [pkey_final, signature_final];
};