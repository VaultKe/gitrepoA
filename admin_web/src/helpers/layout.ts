type ToggleAttributeProps = (
  attribute: string,
  value: string,
  tag?: keyof HTMLElementTagNameMap,
  remove?: boolean,
) => void;

export const toggleDocumentAttribute: ToggleAttributeProps = (
  attribute,
  value,
  tag = "html",
  remove,
): void => {
  if (!document.body) return;
  const element = document.getElementsByTagName(tag)[0];
  const hasAttribute = element?.hasAttribute(attribute);
  if (remove && hasAttribute) {
    element?.removeAttribute(attribute);
  } else element?.setAttribute(attribute, value);
};
