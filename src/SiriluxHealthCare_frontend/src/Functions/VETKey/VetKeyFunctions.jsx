export const hex_decode = (hexString) =>
  Uint8Array.from(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

export const aes_gcm_encrypt = async (data, rawKey) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const aes_key = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const ciphertext_buffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aes_key,
    data
  );
  const ciphertext = new Uint8Array(ciphertext_buffer);
  const iv_and_ciphertext = new Uint8Array(iv.length + ciphertext.length);
  iv_and_ciphertext.set(iv, 0);
  iv_and_ciphertext.set(ciphertext, iv.length);
  return iv_and_ciphertext;
};

export const aes_gcm_decrypt = async (encryptedData, rawKey) => {
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);
  const aes_key = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    "AES-GCM",
    false,
    ["decrypt"]
  );
  const decrypted_buffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    aes_key,
    ciphertext
  );
  return new Uint8Array(decrypted_buffer);
};
