import process from 'node:process'

export class CliError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CliError'
  }
}

export function reportError(error: unknown): never {
  if (error instanceof CliError) {
    console.error(error.message)
  }
  else if (error instanceof Error) {
    console.error(`Error: ${error.message}`)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
  }
  else {
    console.error('Error:', error)
  }
  process.exit(1)
}
