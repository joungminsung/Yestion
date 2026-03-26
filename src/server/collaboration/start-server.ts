import { hocuspocus } from "./hocuspocus";

const port = Number(process.env.COLLAB_PORT) || 4000;

hocuspocus.listen(port).then(() => {
  console.log(`Hocuspocus collaboration server running on port ${port}`);
});
