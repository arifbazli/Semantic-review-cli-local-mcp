import { Router } from "express";
import { getItemById } from "./service";

const router = Router();

// Route handler itself does no DB access — the sink is one hop away in a
// service function, reached by passing the tainted id as a call argument.
router.get("/items/:id", function (req, res) {
  const id = req.params.id;
  getItemById(id).then((item: unknown) => res.json(item));
});

export default router;
