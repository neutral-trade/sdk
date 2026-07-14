export function toCamelCase(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase())
}

export function toPascalCase(value: string): string {
  const camel = toCamelCase(value)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

export function toKebabCase(value: string): string {
  return value.replace(/_/g, '-')
}
