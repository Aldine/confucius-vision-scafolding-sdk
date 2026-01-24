import { Command } from 'commander'

export async function runNotesCli(argv: string[]) {
  const program = new Command()

  program
    .name('confucius-notes')
    .description('Confucius notes utilities - placeholder CLI')

  // Important: this enables async actions without wrapper hacks
  await program.parseAsync(argv)
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  runNotesCli(process.argv).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
