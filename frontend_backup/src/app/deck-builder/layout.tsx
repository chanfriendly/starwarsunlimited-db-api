export default function DeckBuilderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="deck-builder-layout">
      <MainNav />
      <div className="content-area">
        {children}
      </div>
    </div>
  )
}