import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "../firebase";

export async function subirEscudo(uid, file) {
  if (!file.type.startsWith("image/")) throw new Error("El archivo tiene que ser una imagen.");
  if (file.size > 2 * 1024 * 1024) throw new Error("La imagen no puede pesar más de 2 MB.");
  const escudoRef = ref(storage, `escudos/${uid}`);
  await uploadBytes(escudoRef, file, { contentType: file.type });
  const url = await getDownloadURL(escudoRef);
  // Se guarda también en el perfil, para no tener que consultar Storage
  // cada vez que se muestra el escudo en algún sitio.
  await updateDoc(doc(db, "users", uid), { escudoUrl: url });
  return url;
}

export async function borrarEscudo(uid) {
  const escudoRef = ref(storage, `escudos/${uid}`);
  try {
    await deleteObject(escudoRef);
  } catch {
    // si no existía ningún escudo, no pasa nada
  }
  await updateDoc(doc(db, "users", uid), { escudoUrl: null });
}
