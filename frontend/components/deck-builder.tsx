'use client';

import * as React from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { CardDetails } from "@/components/card-details"
import { CardGrid } from "@/components/card-grid"
import { DeckList } from "@/components/deck-list"
import { Card, getCards } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useDeck } from "@/lib/deck-context"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ChevronRight, 
  ChevronLeft, 
  Filter, 
  Search, 
  X, 
  Plus, 
  Minus, 
  Info, 
  Sparkles, 
  Building, 
  LayoutGrid,
  Shield,
  Check,
  Swords
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Card as CardUI, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Deck building stages
type DeckBuildingStage = 'leaders' | 'base' | 'cards';

// Aspect colors for consistent visual cues
const ASPECT_COLORS = {
  'Command': '#e74c3c', // Red
  'Vigilance': '#3498db', // Blue
  'Aggression': '#e67e22', // Orange
  'Cunning': '#9b59b6', // Purple
  'Heroism': '#2ecc71', // Green
  'Villainy': '#1c1c1c', // Black
};

export default function DeckBuilder() {
  // Use deck context for global state
  const { 
    leaders, setLeaders,
    base, setBase,
    cards, addCard, removeCard,
    deckName, setDeckName,
    clearDeck
  } = useDeck();

  // Local state
  const [selectedCard, setSelectedCard] = React.useState<Card | null>(null)
  const [allCards, setAllCards] = React.useState<Card[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showOutOfAspect, setShowOutOfAspect] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<DeckBuildingStage>('leaders')
  const [currentStage, setCurrentStage] = React.useState<DeckBuildingStage>('leaders')
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedCardType, setSelectedCardType] = React.useState<string | null>(null)
  const [showFilters, setShowFilters] = React.useState(false)
  const [aspectStats, setAspectStats] = React.useState<Record<string, number>>({})
  
  // Toast notifications
  const { toast } = useToast();
  
  // Determine current building stage based on deck state
  React.useEffect(() => {
    if (leaders.length < 2) {
      setCurrentStage('leaders');
    } else if (!base) {
      setCurrentStage('base');
    } else {
      setCurrentStage('cards');
    }
    
    // Calculate aspect statistics for UI
    const aspects: Record<string, number> = {};
    
    // Add leader aspects
    leaders.forEach(leader => {
      leader.aspects?.forEach(aspect => {
        aspects[aspect.aspect_name] = (aspects[aspect.aspect_name] || 0) + 1;
      });
    });
    
    // Add base aspects
    if (base) {
      base.aspects?.forEach(aspect => {
        aspects[aspect.aspect_name] = (aspects[aspect.aspect_name] || 0) + 1;
      });
    }
    
    setAspectStats(aspects);
  }, [leaders, base]);

  React.useEffect(() => {
    if (activeTab === 'cards' && currentStage === 'cards' && allCards.length === 0) {
      // If we just switched to the cards tab and no cards are loaded
      // Trigger a fresh card load without any filters
      setSelectedCardType(null);
      setSearchTerm('');
      setPage(1);
    }
  }, [activeTab, currentStage]);

  // Load cards based on current stage
  React.useEffect(() => {
    const loadCards = async () => {
      setLoading(true);
      try {
        // Determine which cards to load based on current tab
        let cardType: string | undefined;
        
        if (activeTab === 'leaders') {
          cardType = 'Leader';
        } else if (activeTab === 'base') {
          cardType = 'Base';
        } else if (selectedCardType) {
          cardType = selectedCardType;
        }
        
        const response = await getCards({ 
          page,
          limit: 24,
          type: cardType,
          search: searchTerm || undefined
        });
        
        setAllCards(response.cards);
        setTotalPages(Math.ceil(response.total / 24));
      } catch (error) {
        console.error("Failed to load cards:", error);
        toast({
          title: "Error",
          description: "Failed to load cards. Please try again."
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadCards();
  }, [activeTab, page, selectedCardType, searchTerm, toast]);

  // Handle card selection logic
  const handleCardSelect = (card: Card) => {
    setSelectedCard(card);
    
    if (activeTab === 'leaders' && leaders.length < 2) {
      // Add leader
      if (!leaders.some(leader => leader.id === card.id)) {
        setLeaders([...leaders, card]);
        toast({
          title: "Leader Added",
          description: `${card.name} has been added as a leader`
        });
      }
    } else if (activeTab === 'base' && !base) {
      // Set base
      setBase(card);
      toast({
        title: "Base Added",
        description: `${card.name} has been set as your base`
      });
    } else if (activeTab === 'cards') {
      // Add regular card to deck
      addCard(card);
      toast({
        title: "Card Added",
        description: `${card.name} has been added to your deck`
      });
    }
  };

  // Check if a card is compatible with deck's aspects
  const isCardInAspect = (card: Card): boolean => {
    if (!base || leaders.length < 2) return false;
    
    // Get all aspects from leaders and base
    const deckAspects = [
      ...leaders.flatMap(leader => leader.aspects?.map(a => a.aspect_name) || []),
      ...(base.aspects?.map(a => a.aspect_name) || [])
    ];

    // Count aspects in deck
    const deckAspectCounts = deckAspects.reduce((acc, aspect) => {
      acc[aspect] = (acc[aspect] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check if card's aspects are present in sufficient quantity
    const cardAspects = card.aspects?.map(a => a.aspect_name) || [];
    const cardAspectCounts = cardAspects.reduce((acc, aspect) => {
      acc[aspect] = (acc[aspect] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(cardAspectCounts).every(([aspect, count]) => 
      (deckAspectCounts[aspect] || 0) >= count
    );
  };

  // Filter cards for display based on current stage and filters
  const displayCards = React.useMemo(() => {
    if (activeTab === 'cards') {
      // If we're in the cards tab but no cards are loaded yet,
      // force an initial load of all compatible cards
      if (allCards.length === 0 && !loading) {
        // Using a setTimeout to avoid triggering during render
        setTimeout(() => {
          // Reset any filters that might be preventing cards from loading
          if (selectedCardType === null && searchTerm === '') {
            // This will trigger the useEffect to load all cards
            setPage(1);
          }
        }, 0);
      }
      
      const filteredCards = allCards.filter(card => 
        card.type !== 'Leader' && card.type !== 'Base'
      );
      
      return showOutOfAspect ? filteredCards : filteredCards.filter(isCardInAspect);
    }
    return allCards;
  }, [allCards, activeTab, showOutOfAspect, isCardInAspect, loading, selectedCardType, searchTerm]);

  // Navigation handlers
  const goToNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const goToPrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  // Move to next stage in deck building process
  const progressToNextStage = () => {
    if (activeTab === 'leaders' && leaders.length === 2) {
      setActiveTab('base');
    } else if (activeTab === 'base' && base) {
      setActiveTab('cards');
    }
  };

  // Remove leader
  const removeLeader = (leaderId: string) => {
    setLeaders(leaders.filter(leader => leader.id !== leaderId));
    toast({
      title: "Leader Removed",
      description: "Leader has been removed from your deck"
    });
  };

  // Remove base
  const removeBase = () => {
    setBase(null);
    toast({
      title: "Base Removed",
      description: "Base has been removed from your deck"
    });
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedCardType(null);
    setSearchTerm("");
    setPage(1);
  };
  
  // Validate deck
  const validateDeck = (): { valid: boolean; message: string; progress: number } => {
    let progress = 0;
    
    if (leaders.length === 2) {
      progress += 40;
    } else if (leaders.length === 1) {
      progress += 20;
    }
    
    if (base) {
      progress += 20;
    }
    
    const totalCardCount = cards.reduce((sum, item) => sum + item.quantity, 0);
    if (totalCardCount >= 10) {
      progress += 40;
    } else if (totalCardCount > 0) {
      progress += (totalCardCount / 10) * 40;
    }
    
    if (leaders.length < 2) {
      return { valid: false, message: "You need to select 2 leaders", progress };
    }
    
    if (!base) {
      return { valid: false, message: "You need to select a base", progress };
    }
    
    if (totalCardCount < 10) {
      return { valid: false, message: `You need at least 10 cards (currently ${totalCardCount})`, progress };
    }
    
    return { valid: true, message: "Deck is valid and ready to play!", progress: 100 };
  };

  // Get stage information
  const getStageInfo = () => {
    switch (activeTab) {
      case 'leaders':
        return {
          title: "Select Leaders",
          description: "Choose 2 leader cards to define your deck's strategy",
          icon: <Sparkles className="h-5 w-5 mr-2" />,
          progress: leaders.length * 50
        };
      case 'base':
        return {
          title: "Select Base",
          description: "Choose a base card for your deck",
          icon: <Building className="h-5 w-5 mr-2" />,
          progress: base ? 100 : 0
        };
      case 'cards':
        return {
          title: "Add Cards",
          description: "Build your deck with cards that match your leaders' aspects",
          icon: <LayoutGrid className="h-5 w-5 mr-2" />,
          progress: Math.min(100, (cards.reduce((sum, item) => sum + item.quantity, 0) / 10) * 100)
        };
    }
  };

  const stageInfo = getStageInfo();
  const deckValidation = validateDeck();

  // Calculate compatibility status for card styling
  const getCompatibilityStatus = (card: Card): { compatible: boolean; compatibility: 'full' | 'partial' | 'none' } => {
    if (!base || leaders.length < 2 || !card.aspects || card.aspects.length === 0) {
      return { compatible: true, compatibility: 'full' as const };
    }
  
    const deckAspects = new Set([
      ...leaders.flatMap(leader => leader.aspects?.map(a => a.aspect_name) || []),
      ...(base.aspects?.map(a => a.aspect_name) || [])
    ]);
  
    const cardAspects = card.aspects.map(a => a.aspect_name);
    const matchingAspects = cardAspects.filter(aspect => deckAspects.has(aspect));
  
    if (matchingAspects.length === cardAspects.length) {
      return { compatible: true, compatibility: 'full' as const };
    } else if (matchingAspects.length > 0) {
      return { compatible: true, compatibility: 'partial' as const };
    } else {
      return { compatible: false, compatibility: 'none' as const };
    }
  };

  // Common card grid component for all tabs
  const CardGridSection = () => (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-[7/10] bg-muted animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : displayCards.length === 0 ? (
            <div className="text-center p-12 border rounded-lg border-border bg-muted/20">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No cards found</h3>
              <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
              <Button
                variant="outline"
                onClick={resetFilters}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <>
              <CardGrid
                cards={displayCards}
                onCardClick={handleCardSelect}
                selectedCardId={selectedCard?.id}
                getCompatibilityStatus={activeTab === 'cards' ? getCompatibilityStatus : undefined}
              />
              
              {/* Pagination */}
              <div className="flex items-center justify-center mt-8 space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrevPage}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="px-4 py-1 rounded-md bg-muted text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="h-full bg-black bg-opacity-90 bg-[url('/hero-background.jpg')] bg-cover bg-center bg-blend-overlay">
      {/* Progress Header */}
      <div className="border-b bg-black/60 backdrop-blur-md p-4">
        <div className="container mx-auto">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Star Wars Unlimited: Deck Builder</h1>
              <Input 
                placeholder="Deck Name" 
                className="w-64 bg-black/50" 
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
              />
            </div>
            
            {/* Progress Bar */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Deck Completion</span>
                <span>{Math.round(deckValidation.progress)}%</span>
              </div>
              <Progress value={deckValidation.progress} className="h-2" />
              
              {/* Validation Message */}
              {!deckValidation.valid ? (
                <div className="flex items-center text-amber-400 text-sm mt-1">
                  <Info className="h-4 w-4 mr-1" />
                  {deckValidation.message}
                </div>
              ) : (
                <div className="flex items-center text-green-400 text-sm mt-1">
                  <Check className="h-4 w-4 mr-1" />
                  {deckValidation.message}
                </div>
              )}
            </div>
            
            {/* Step Indicators */}
            <div className="flex items-center justify-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center justify-center h-10 w-10 rounded-full border-2 ${leaders.length === 2 ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-muted-foreground/30 bg-black/40'} mr-1`}>
                      <Sparkles className="h-5 w-5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Leaders: {leaders.length}/2 Selected</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className={`w-16 h-0.5 ${leaders.length === 2 ? 'bg-green-500/50' : 'bg-muted-foreground/20'}`}></div>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center justify-center h-10 w-10 rounded-full border-2 ${base ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-muted-foreground/30 bg-black/40'} mr-1`}>
                      <Building className="h-5 w-5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Base: {base ? 'Selected' : 'Not Selected'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className={`w-16 h-0.5 ${base ? 'bg-green-500/50' : 'bg-muted-foreground/20'}`}></div>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center justify-center h-10 w-10 rounded-full border-2 ${cards.length >= 10 ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-muted-foreground/30 bg-black/40'} mr-1`}>
                      <LayoutGrid className="h-5 w-5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cards: {cards.reduce((sum, item) => sum + item.quantity, 0)}/10 Added</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b py-2 bg-black/40">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DeckBuildingStage)}>
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="leaders" disabled={currentStage === 'leaders' && leaders.length === 2}>
              <Sparkles className="h-4 w-4 mr-2" />
              Leaders
              {leaders.length > 0 && (
                <Badge className="ml-2 bg-primary/20 border border-primary/50">
                  {leaders.length}/2
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="base" disabled={currentStage === 'leaders'}>
              <Building className="h-4 w-4 mr-2" />
              Base
              {base && (
                <Badge variant="outline" className="ml-2 bg-green-500/20 border-green-500 text-green-400">
                  ✓
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="cards" disabled={currentStage === 'leaders' || currentStage === 'base'}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Cards
              {cards.length > 0 && (
                <Badge className="ml-2 bg-primary/20 border border-primary/50">
                  {cards.reduce((sum, item) => sum + item.quantity, 0)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        
          {/* Content for each tab - must be inside the Tabs component */}
          <div className="mt-4">
            <TabsContent value="leaders" className="m-0 p-0">
              <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-12rem)]">
                {/* Left panel - Deck List */}
                <ResizablePanel defaultSize={20}>
                  <div className="h-full border-r bg-black/40 backdrop-blur-sm">
                    <div className="p-4 border-b bg-black/30">
                      <h3 className="font-bold flex items-center">
                        <Shield className="h-4 w-4 mr-2" />
                        Deck Summary
                      </h3>
                    </div>
                    <DeckList />
                  </div>
                </ResizablePanel>
                
                <ResizableHandle withHandle className="bg-muted" />
                
                {/* Center panel - Card selection */}
                <ResizablePanel defaultSize={55}>
                  <div className="h-full flex flex-col bg-black/30 backdrop-blur-sm">
                    <div className="p-4 border-b bg-black/20">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold flex items-center">
                          {stageInfo?.icon}
                          {stageInfo?.title}
                        </h2>
                        <div className="flex space-x-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search leaders..."
                              className="pl-9 bg-black/30 border-border/50 w-64"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => setSearchTerm("")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {leaders.length === 2 && (
                            <Button onClick={progressToNextStage}>
                              Next: Select Base
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-muted-foreground">{stageInfo?.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                        {leaders.map((leader) => (
                          <div key={leader.id} className="flex items-center bg-primary/20 border border-primary/30 rounded-full px-3 py-1">
                            <span className="text-sm">Leader: {leader.name}</span>
                            <button 
                              className="ml-2 text-muted-foreground hover:text-destructive"
                              onClick={() => removeLeader(leader.id)}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {leaders.length < 2 && Array(2 - leaders.length).fill(0).map((_, i) => (
                          <div key={`leader-placeholder-${i}`} className="flex items-center bg-muted/20 border border-muted/20 rounded-full px-3 py-1">
                            <span className="text-sm text-muted-foreground">Leader {leaders.length + i + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <CardGridSection />
                  </div>
                </ResizablePanel>
                
                <ResizableHandle withHandle className="bg-muted" />
                
                {/* Right panel - Card Details */}
                <ResizablePanel defaultSize={25}>
                  <div className="h-full border-l bg-black/40 backdrop-blur-sm">
                    <div className="p-4 border-b bg-black/30">
                      <h3 className="font-bold flex items-center">
                        <Info className="h-4 w-4 mr-2" /> 
                        Card Details
                      </h3>
                    </div>
                    {selectedCard ? (
                      <div className="h-full flex flex-col">
                        <CardDetails card={selectedCard} />
                        
                        <div className="p-4 border-t bg-black/30">
                          {leaders.length < 2 && !leaders.some(l => l.id === selectedCard.id) && (
                            <Button 
                              className="w-full"
                              onClick={() => handleCardSelect(selectedCard)}
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              Select as Leader
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                          <Info className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No card selected</h3>
                        <p className="text-muted-foreground">
                          Select a card from the grid to view its details
                        </p>
                      </div>
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </TabsContent>
            
            <TabsContent value="base" className="m-0 p-0">
              <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-12rem)]">
                {/* Left panel - Deck List */}
                <ResizablePanel defaultSize={20}>
                  <div className="h-full border-r bg-black/40 backdrop-blur-sm">
                    <div className="p-4 border-b bg-black/30">
                      <h3 className="font-bold flex items-center">
                        <Shield className="h-4 w-4 mr-2" />
                        Deck Summary
                      </h3>
                    </div>
                    <DeckList />
                  </div>
                </ResizablePanel>
                
                <ResizableHandle withHandle className="bg-muted" />
                
                {/* Center panel - Card selection */}
                <ResizablePanel defaultSize={55}>
                  <div className="h-full flex flex-col bg-black/30 backdrop-blur-sm">
                    <div className="p-4 border-b bg-black/20">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold flex items-center">
                          {stageInfo?.icon}
                          {stageInfo?.title}
                        </h2>
                        <div className="flex space-x-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search bases..."
                              className="pl-9 bg-black/30 border-border/50 w-64"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => setSearchTerm("")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {base && (
                            <Button onClick={progressToNextStage}>
                              Next: Add Cards
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-muted-foreground">{stageInfo?.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                        {base ? (
                          <div className="flex items-center bg-primary/20 border border-primary/30 rounded-full px-3 py-1">
                            <span className="text-sm">Base: {base.name}</span>
                            <button 
                              className="ml-2 text-muted-foreground hover:text-destructive"
                              onClick={removeBase}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center bg-muted/20 border border-muted/20 rounded-full px-3 py-1">
                            <span className="text-sm text-muted-foreground">Base (Not Selected)</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <CardGridSection />
                  </div>
                </ResizablePanel>
                
                <ResizableHandle withHandle className="bg-muted" />
                
                {/* Right panel - Card Details */}
                <ResizablePanel defaultSize={25}>
                  <div className="h-full border-l bg-black/40 backdrop-blur-sm">
                    <div className="p-4 border-b bg-black/30">
                      <h3 className="font-bold flex items-center">
                        <Info className="h-4 w-4 mr-2" /> 
                        Card Details
                      </h3>
                    </div>
                    {selectedCard ? (
                      <div className="h-full flex flex-col">
                        <CardDetails card={selectedCard} />
                        
                        <div className="p-4 border-t bg-black/30">
                          {!base && (
                            <Button 
                              className="w-full"
                              onClick={() => handleCardSelect(selectedCard)}
                            >
                              <Building className="h-4 w-4 mr-2" />
                              Select as Base
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                          <Info className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No card selected</h3>
                        <p className="text-muted-foreground">
                          Select a card from the grid to view its details
                        </p>
                      </div>
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </TabsContent>
            
            <TabsContent value="cards" className="m-0 p-0">
              <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-12rem)]">
                {/* Left panel - Deck List */}
                <ResizablePanel defaultSize={20}>
                  <div className="h-full border-r bg-black/40 backdrop-blur-sm">
                    <div className="p-4 border-b bg-black/30">
                      <h3 className="font-bold flex items-center">
                        <Shield className="h-4 w-4 mr-2" />
                        Deck Summary
                      </h3>
                    </div>
                    <DeckList />
                  </div>
                </ResizablePanel>
                
                <ResizableHandle withHandle className="bg-muted" />
                
                {/* Center panel - Card selection */}
                <ResizablePanel defaultSize={55}>
                  <div className="h-full flex flex-col bg-black/30 backdrop-blur-sm">
                    <div className="p-4 border-b bg-black/20">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold flex items-center">
                          {stageInfo?.icon}
                          {stageInfo?.title}
                        </h2>
                        <div className="flex space-x-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search cards..."
                              className="pl-9 bg-black/30 border-border/50 w-64"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => setSearchTerm("")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <Sheet open={showFilters} onOpenChange={setShowFilters}>
                            <SheetTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Filter className="w-4 h-4 mr-1" />
                                Filters
                              </Button>
                            </SheetTrigger>
                            <SheetContent>
                              <div className="py-4">
                                <h3 className="font-medium mb-4">Card Type</h3>
                                <div className="flex flex-wrap gap-2 mb-6">
                                  {['Unit', 'Event', 'Epic', 'Upgrade'].map(type => (
                                    <Button
                                      key={type}
                                      variant={selectedCardType === type ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setSelectedCardType(selectedCardType === type ? null : type)}
                                    >
                                      {type}
                                    </Button>
                                  ))}
                                </div>
                                
                                <Separator className="my-4" />
                                
                                <div className="flex items-center space-x-3">
                                  <Checkbox
                                    id="showAllSheet"
                                    checked={showOutOfAspect}
                                    onCheckedChange={(checked) => setShowOutOfAspect(checked === true)}
                                  />
                                  <label htmlFor="showAllSheet" className="text-sm">
                                    Show out of aspect cards
                                  </label>
                                </div>
                                
                                <Button
                                  variant="outline"
                                  className="w-full mt-4"
                                  onClick={resetFilters}
                                >
                                  Reset Filters
                                </Button>
                              </div>
                            </SheetContent>
                          </Sheet>
                        </div>
                      </div>
                      <p className="text-muted-foreground">{stageInfo?.description}</p>
                      
                      {/* Aspect chips */}
                      {Object.keys(aspectStats).length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-1">Deck Aspects</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(aspectStats).map(([aspect, count]) => {
                              const aspectColor = ASPECT_COLORS[aspect as keyof typeof ASPECT_COLORS] || '#6c757d';
                              return (
                                <Badge 
                                  key={aspect}
                                  variant="outline"
                                  style={{
                                    backgroundColor: `${aspectColor}20`,
                                    borderColor: aspectColor,
                                    color: aspectColor
                                  }}
                                >
                                  {aspect} x{count}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center mt-3">
                        <Checkbox
                          id="showAllInline"
                          checked={showOutOfAspect}
                          onCheckedChange={(checked) => setShowOutOfAspect(checked === true)}
                          className="mr-2"
                        />
                        <label htmlFor="showAllInline" className="text-sm">
                          Show cards that don't match my deck's aspects
                        </label>
                      </div>
                    </div>
                    
                    <CardGridSection />
                  </div>
                </ResizablePanel>
                
                <ResizableHandle withHandle className="bg-muted" />
                
                {/* Right panel - Card Details */}
                <ResizablePanel defaultSize={25}>
                  <div className="h-full border-l bg-black/40 backdrop-blur-sm">
                    <div className="p-4 border-b bg-black/30">
                      <h3 className="font-bold flex items-center">
                        <Info className="h-4 w-4 mr-2" /> 
                        Card Details
                      </h3>
                    </div>
                    {selectedCard ? (
                      <div className="h-full flex flex-col">
                        <CardDetails card={selectedCard} />
                        
                        <div className="p-4 border-t bg-black/30">
                          <div className="flex space-x-2">
                            <Button 
                              className="flex-1"
                              onClick={() => handleCardSelect(selectedCard)}
                              disabled={!showOutOfAspect && !isCardInAspect(selectedCard)}
                            >
                              <Plus className="w-4 h-4 mr-1" /> Add to Deck
                            </Button>
                            
                            {cards.some(c => c.card.id === selectedCard.id) && (
                              <Button 
                                variant="outline"
                                onClick={() => removeCard(selectedCard.id)}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          
                          {!isCardInAspect(selectedCard) && (
                            <div className="mt-3 p-3 bg-amber-950/20 border border-amber-900/40 rounded text-amber-500 text-sm">
                              <Info className="h-4 w-4 inline mr-1" />
                              This card requires aspects not present in your deck.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                          <Info className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No card selected</h3>
                        <p className="text-muted-foreground">
                          Select a card from the grid to view its details
                        </p>
                      </div>
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}