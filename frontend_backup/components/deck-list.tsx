"use client"
import { Download, Save, Trash2, Plus, Minus, Info, FileText, Share2, HelpCircle } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDeck } from "@/lib/deck-context"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card as CardUI } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { motion, AnimatePresence } from "framer-motion"

export function DeckList() {
  const { 
    deckName, 
    setDeckName, 
    cards, 
    leaders, 
    base, 
    removeCard, 
    updateCardQuantity, 
    saveDeck 
  } = useDeck();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to save your deck",
        variant: "destructive"
      });
      router.push("/auth/login");
      return;
    }

    try {
      const deckId = await saveDeck();
      toast({
        title: "Deck saved",
        description: `Your deck "${deckName}" has been saved successfully.`
      });
    } catch (error) {
      toast({
        title: "Failed to save deck",
        description: "An error occurred while saving your deck.",
        variant: "destructive"
      });
    }
  };

  const exportDeck = () => {
    const deckData = {
      name: deckName,
      leaders: leaders.map(leader => leader.name),
      base: base?.name || null,
      cards: cards.map(item => ({ name: item.card.name, quantity: item.quantity }))
    };
    
    const dataStr = JSON.stringify(deckData, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `${deckName.replace(/\s+/g, '_')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Deck exported",
      description: `Your deck has been exported as ${exportFileDefaultName}`
    });
  };

  const calculateCardTypeCount = (type: string) => {
    return cards
      .filter(item => item.card.type === type)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const totalCards = cards.reduce((sum, item) => sum + item.quantity, 0) + 
                  leaders.length + (base ? 1 : 0);
                  
  const handleIncreaseQuantity = (cardId: string, currentQuantity: number) => {
    updateCardQuantity(cardId, currentQuantity + 1);
  };
  
  const handleDecreaseQuantity = (cardId: string, currentQuantity: number) => {
    if (currentQuantity > 1) {
      updateCardQuantity(cardId, currentQuantity - 1);
    } else {
      removeCard(cardId);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-4 bg-zinc-900/60">
        <Input 
          placeholder="Deck Name" 
          className="flex-1 bg-black/40" 
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleSave}>
                <Save className="h-4 w-4" />
                <span className="sr-only">Save deck</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Save Deck</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={exportDeck}>
                <Download className="h-4 w-4" />
                <span className="sr-only">Export deck</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export Deck</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <Dialog>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Share2 className="h-4 w-4" />
                    <span className="sr-only">Share deck</span>
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Share Deck</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DialogContent>
            <DialogTitle>Share Your Deck</DialogTitle>
            <DialogDescription>
              Copy and share the link below to share your deck with others.
            </DialogDescription>
            <div className="flex space-x-2">
              <Input 
                readOnly 
                value={`https://starwarsunlimited-db.example.com/deck/${btoa(deckName)}`} 
                className="bg-muted"
              />
              <Button variant="outline">Copy</Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Note: You need to save your deck before sharing it with others.
            </p>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Deck Stats Card */}
      <div className="p-4 border-b">
        <CardUI className="bg-black/20">
          <div className="p-4">
            <h3 className="text-sm font-medium mb-2 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Deck Statistics
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Cards</span>
                <Badge variant="outline" className="border-primary/50 bg-primary/10">
                  {totalCards}
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm">Leaders</span>
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10">
                  {leaders.length}/2
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Base</span>
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10">
                  {base ? 1 : 0}/1
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm">Units</span>
                <Badge variant="outline" className="border-zinc-500/50 bg-zinc-500/10">
                  {calculateCardTypeCount("Unit")}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Events</span>
                <Badge variant="outline" className="border-zinc-500/50 bg-zinc-500/10">
                  {calculateCardTypeCount("Event")}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Upgrades</span>
                <Badge variant="outline" className="border-zinc-500/50 bg-zinc-500/10">
                  {calculateCardTypeCount("Upgrade")}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Epics</span>
                <Badge variant="outline" className="border-zinc-500/50 bg-zinc-500/10">
                  {calculateCardTypeCount("Epic")}
                </Badge>
              </div>
            </div>
          </div>
        </CardUI>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {(leaders.length > 0 || base || cards.length > 0) ? (
            <div className="p-4">
              {/* Leaders Section */}
              {leaders.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2 flex items-center text-amber-400">
                    <span className="h-3 w-3 rounded-full bg-amber-400 mr-2"></span>
                    Leaders
                  </h3>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {leaders.map((leader) => (
                        <motion.div
                          key={leader.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          className="flex items-center justify-between p-2 rounded-md bg-amber-950/20 border border-amber-800/30"
                        >
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded overflow-hidden mr-3 border border-amber-500/20">
                              {leader.image_uri && (
                                <img 
                                  src={leader.image_uri} 
                                  alt={leader.name} 
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{leader.name}</p>
                              <p className="text-xs text-muted-foreground">Leader</p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeCard(leader.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              
              {/* Base Section */}
              {base && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2 flex items-center text-blue-400">
                    <span className="h-3 w-3 rounded-full bg-blue-400 mr-2"></span>
                    Base
                  </h3>
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="flex items-center justify-between p-2 rounded-md bg-blue-950/20 border border-blue-800/30"
                  >
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded overflow-hidden mr-3 border border-blue-500/20">
                        {base.image_uri && (
                          <img 
                            src={base.image_uri} 
                            alt={base.name} 
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{base.name}</p>
                        <p className="text-xs text-muted-foreground">Base</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCard(base.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </div>
              )}
              
              {/* Cards Section */}
              {cards.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center text-green-400">
                    <span className="h-3 w-3 rounded-full bg-green-400 mr-2"></span>
                    Cards
                  </h3>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {cards.map((item) => (
                        <motion.div
                          key={item.card.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          className="flex items-center justify-between p-2 rounded-md bg-zinc-900/40 border border-zinc-800/60 hover:bg-zinc-900/60 transition-colors"
                        >
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded overflow-hidden mr-3 border border-zinc-700/50">
                              {item.card.image_uri && (
                                <img 
                                  src={item.card.image_uri} 
                                  alt={item.card.name} 
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{item.card.name}</p>
                              <p className="text-xs text-muted-foreground">{item.card.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <div className="flex items-center space-x-1 mr-2">
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-6 w-6 rounded-full"
                                onClick={() => handleDecreaseQuantity(item.card.id, item.quantity)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-5 text-center text-sm">{item.quantity}</span>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-6 w-6 rounded-full"
                                onClick={() => handleIncreaseQuantity(item.card.id, item.quantity)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeCard(item.card.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              
              {/* Empty State */}
              {leaders.length === 0 && !base && cards.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-10">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <HelpCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">Your deck is empty</h3>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    Start by selecting 2 leaders, then a base, and finally add cards to complete your deck.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-10 h-full">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <HelpCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">Your deck is empty</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Start by selecting 2 leaders, then a base, and finally add cards to complete your deck.
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}