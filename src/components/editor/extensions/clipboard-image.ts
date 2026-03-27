import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const ClipboardImage = Extension.create({
  name: "clipboardImage",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [new Plugin({
      key: new PluginKey("clipboardImage"),
      props: {
        handlePaste(view, event) {
          const items = event.clipboardData?.items;
          if (!items) return false;

          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) return false;

              // Upload the image
              const formData = new FormData();
              formData.append("file", file);

              // Insert placeholder while uploading
              editor.chain().focus().insertContent({
                type: "image",
                attrs: { src: "", alt: "업로드 중..." },
              }).run();

              fetch("/api/upload", { method: "POST", body: formData })
                .then(res => res.json())
                .then(data => {
                  if (data.url) {
                    // Find and replace the placeholder image
                    const { doc } = editor.state;
                    doc.descendants((node, pos) => {
                      if (node.type.name === "image" && node.attrs.src === "" && node.attrs.alt === "업로드 중...") {
                        editor.chain().focus().setNodeSelection(pos).updateAttributes("image", { src: data.url, alt: "" }).run();
                        return false;
                      }
                    });
                  }
                })
                .catch(() => {
                  // Remove placeholder on error
                });

              return true;
            }
          }
          return false;
        },
      },
    })];
  },
});
