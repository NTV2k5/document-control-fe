declare module '@ckeditor/ckeditor5-inspector' {
  type InspectorApi = {
    attach: (editor: unknown) => void;
    detach?: () => void;
  };

  const CKEditorInspector: InspectorApi;
  export default CKEditorInspector;
}
