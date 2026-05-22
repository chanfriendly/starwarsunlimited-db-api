'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SavedDeck, deleteUserDeck, fetchUserAchievements, AchievementsResponse } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetch-utils';
import { AchievementBadge } from '@/components/AchievementBadge';

interface CollectionItem {
    card: {
        id: string;
        name: string;
        type?: string;
        image_uri?: string;
        image_url?: string;
        set_name?: string;
        set_code?: string;
        card_number?: string;
        aspects?: Array<{ aspect_name: string; aspect_color?: string }>;
    };
    count: number;
    in_collection?: boolean;
}

interface UserProfileData {
    id: string;
    username: string;
    avatarUrl?: string;
    createdAt: string;
}

interface WishlistItem {
    card: {
        id: string;
        name: string;
        type?: string;
        image_uri?: string;
        energy_cost?: number;
        set_name?: string;
        aspects?: Array<{ aspect_name: string; aspect_color?: string }>;
    };
    added_at: string | null;
}

const ASPECT_COLORS: Record<string, string> = {
    Command: '#c2453a', Aggression: '#d96f2d', Cunning: '#e2b342',
    Heroism: '#ead7a8', Vigilance: '#4a90c4', Villainy: '#2c2a26',
};

const defaultUserProfile: UserProfileData = {
    id: '',
    username: '',
    createdAt: '',
};

// ── DeckCard ────────────────────────────────────────────────────────────────

function DeckCard({ deck, onDelete }: { deck: SavedDeck; onDelete: (id: string) => void }) {
    const deckAspects = new Set<string>();
    if (deck.leaders && Array.isArray(deck.leaders)) {
        deck.leaders.forEach(leader => {
            if (leader?.aspects) leader.aspects.forEach(a => { if (a?.aspect_name) deckAspects.add(a.aspect_name); });
        });
    }
    if (deck.base?.aspects) {
        deck.base.aspects.forEach(a => { if (a?.aspect_name) deckAspects.add(a.aspect_name); });
    }

    const totalCards = deck.cards ? deck.cards.reduce((sum, item) => sum + item.quantity, 0) : 0;
    const formattedDate = deck.updated_at
        ? (new Date(deck.updated_at).getTime() > 0 ? new Date(deck.updated_at).toLocaleDateString() : 'Recently')
        : 'Recently';

    return (
        <div style={{ background: 'var(--ts-panel)', border: '1px solid var(--ts-line)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Title + card count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 20, color: 'var(--ts-ink)', lineHeight: 1.2 }}>
                    {deck.name}
                </div>
                <div className="ts-chip" style={{ flexShrink: 0 }}>{totalCards} cards</div>
            </div>

            {/* Leader thumbnails */}
            {deck.leaders && deck.leaders.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                    {deck.leaders.map(leader => (
                        <div key={leader.id} style={{ width: 40, height: 40, overflow: 'hidden', border: '1px solid var(--ts-line-2)', flexShrink: 0 }}>
                            <img
                                src={leader.image_uri || leader.image_url || ''}
                                alt={leader.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Aspect pips */}
            {deckAspects.size > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {Array.from(deckAspects).map(aspect => (
                        <span key={aspect} className="ts-aspect-pip" data-aspect={aspect} title={aspect}>
                            {aspect[0]}
                        </span>
                    ))}
                </div>
            )}

            {/* Date */}
            <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Updated {formattedDate}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Link
                    href={`/decks/${deck.id}`}
                    className="ts-btn ts-btn-sm"
                    style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}
                >
                    View Deck →
                </Link>
                <button
                    onClick={() => onDelete(deck.id)}
                    className="ts-btn ts-btn-sm"
                    style={{ borderColor: 'var(--ts-red)', color: 'var(--ts-red)' }}
                    title="Delete deck"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

// ── CollectionCard ──────────────────────────────────────────────────────────

function CollectionCard({
    collectionItem,
    onAddToCollection,
}: {
    collectionItem: CollectionItem;
    onAddToCollection: (cardId: string, quantity?: number) => Promise<void>;
}) {
    const { card, count, in_collection = false } = collectionItem;

    return (
        <div style={{
            background: 'var(--ts-panel)',
            border: '1px solid var(--ts-line)',
            opacity: in_collection ? 1 : 0.55,
            display: 'flex',
            flexDirection: 'column',
        }}>
            <div style={{ aspectRatio: '2/3', overflow: 'hidden' }}>
                <img
                    src={card.image_uri || card.image_url || ''}
                    alt={card.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
            </div>

            <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{
                    fontFamily: 'var(--ts-font-display)', fontSize: 11, color: 'var(--ts-ink)',
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', lineHeight: 1.3,
                }}>
                    {card.name}
                </div>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {card.type}
                </div>
                {card.aspects && card.aspects.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {card.aspects.map(a => (
                            <span key={a.aspect_name} className="ts-aspect-pip" data-aspect={a.aspect_name} title={a.aspect_name} style={{ width: 14, height: 14, fontSize: 7 }}>
                                {a.aspect_name[0]}
                            </span>
                        ))}
                    </div>
                )}
                {in_collection ? (
                    <div className="ts-chip" style={{ alignSelf: 'flex-start', fontSize: 9, marginTop: 'auto' }}>×{count}</div>
                ) : (
                    <button
                        className="ts-btn ts-btn-sm"
                        style={{ fontSize: 8, padding: '4px 8px', marginTop: 'auto' }}
                        onClick={() => onAddToCollection(card.id)}
                    >
                        + Add
                    </button>
                )}
            </div>
        </div>
    );
}

// ── ComingSoonPanel ─────────────────────────────────────────────────────────

function ComingSoonPanel({ title, description, features }: { title: string; description: string; features: string[] }) {
    return (
        <div style={{ position: 'relative', minHeight: 400, border: '1px solid var(--ts-line)', background: 'var(--ts-panel)', overflow: 'hidden' }}>
            {/* Ghost preview */}
            <div style={{ padding: 32, opacity: 0.12, pointerEvents: 'none', userSelect: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} style={{ height: 96, background: 'var(--ts-panel-2)', border: '1px solid var(--ts-line-2)' }} />
                    ))}
                </div>
            </div>

            {/* Overlay */}
            <div style={{
                position: 'absolute', inset: 0, background: 'rgba(26,22,17,0.90)',
                backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center',
            }}>
                <div style={{
                    fontFamily: 'var(--ts-font-mono)', fontSize: 10, letterSpacing: '0.28em',
                    textTransform: 'uppercase', color: 'var(--ts-amber)', border: '1.5px solid var(--ts-amber)',
                    padding: '4px 14px', marginBottom: 24, transform: 'rotate(-1deg)', opacity: 0.9,
                }}>
                    Coming Soon
                </div>

                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 32, color: 'var(--ts-ink)', marginBottom: 12, letterSpacing: '0.02em' }}>
                    {title}
                </div>

                <p style={{ color: 'var(--ts-ink-2)', fontSize: 14, lineHeight: 1.7, maxWidth: 540, margin: '0 0 28px' }}>
                    {description}
                </p>

                <div style={{ border: '1px solid var(--ts-line-2)', padding: '16px 24px', textAlign: 'left', maxWidth: 480, width: '100%' }}>
                    <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ts-ink-3)', marginBottom: 12 }}>
                        Planned Features
                    </div>
                    {features.map(f => (
                        <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-2)', lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--ts-amber)', flexShrink: 0, marginTop: 1 }}>◈</span>
                            {f}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── WishlistCard ────────────────────────────────────────────────────────────

function WishlistCard({ item, onRemove }: { item: WishlistItem; onRemove: (cardId: string) => void }) {
    const { card } = item;
    const aspects = card.aspects ?? [];
    const bg =
        aspects.length === 1
            ? `linear-gradient(155deg, ${ASPECT_COLORS[aspects[0].aspect_name] ?? '#2c251a'}, #2c251a)`
            : aspects.length >= 2
            ? `linear-gradient(155deg, ${aspects.map(a => ASPECT_COLORS[a.aspect_name] ?? '#2c251a').join(', ')})`
            : 'linear-gradient(155deg, #2c251a, #1f1a12)';

    return (
        <div style={{ background: bg, border: '1px solid var(--ts-line-2)', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
            <div style={{ aspectRatio: '5/7', position: 'relative', overflow: 'hidden' }}>
                {card.image_uri ? (
                    <img src={card.image_uri} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'rgba(255,255,255,0.15)' }}>{card.name[0]}</span>
                    </div>
                )}
                <button
                    onClick={() => onRemove(card.id)}
                    style={{
                        position: 'absolute', top: 6, right: 6, width: 22, height: 22,
                        background: 'rgba(10,8,4,0.82)', border: '1px solid rgba(255,255,255,0.2)',
                        color: 'var(--ts-red)', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1,
                    }}
                    title="Remove from wishlist"
                >
                    ✕
                </button>
            </div>

            <div style={{ padding: '6px 8px', background: 'rgba(20,16,10,0.92)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{
                    fontFamily: 'var(--ts-font-display)', fontSize: 11, color: '#e8dcc4',
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', lineHeight: 1.3,
                }}>
                    {card.name}
                </div>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                    {card.type}
                </div>
            </div>
        </div>
    );
}

// ── Pilot Training lesson content ───────────────────────────────────────────

const RANK_LESSONS: Record<string, { gate: string; lesson: React.ReactNode }> = {
    K1: {
        gate: 'Build your first deck.',
        lesson: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p><strong>What is Twin Suns?</strong> Twin Suns is a two-player format where each player brings two leaders and one base. Your base starts with a set HP total — when it reaches zero, you lose. Leaders sit in a special zone and can be deployed as powerful units later in the game.</p>
                <p><strong>Deck structure:</strong> Every deck is 50 cards (no leaders or base counted). You can run up to 3 copies of any card. Leaders and bases are chosen separately when you save your deck.</p>
                <p><strong>Reading a card:</strong> The top-left number is its energy cost. Power and HP appear at the bottom. Aspects appear as colored icons — these determine which leaders can play the card without a penalty. Keywords (like <em>Ambush</em> or <em>Sentinel</em>) appear in bold in the text box.</p>
                <p><strong>Get started:</strong> Use the Deck Builder to put together your first 50-card list. Try browsing by aspect to find cards that match your leaders.</p>
            </div>
        ),
    },
    K2: {
        gate: 'Save three decks.',
        lesson: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p><strong>Resources and energy:</strong> You gain one additional resource each round (1 on round 1, 2 on round 2, and so on). Planning your curve — having cards to play at every cost — is one of the most important parts of deckbuilding.</p>
                <p><strong>Aspect penalties:</strong> If you play a card whose aspect doesn&apos;t match either of your leaders, you pay 2 extra resources for each off-aspect icon. This is a real cost. Build your deck around your leaders&apos; aspects to minimize penalties.</p>
                <p><strong>Your opening hand:</strong> You draw 6 cards and may mulligan once (shuffle back any number, draw replacements). A good keep has a mix of early plays and late-game power. A hand of all expensive cards is usually a mulligan. Use the Hand Simulator on any deck to practice evaluating hands.</p>
                <p><strong>The initiative token:</strong> Whoever holds initiative decides who goes first next round. Passing initiative early can set up a tempo swing — taking it back to deploy a leader or play a big card at the right moment.</p>
            </div>
        ),
    },
    K3: {
        gate: 'Build decks spanning all 6 aspects across your collection.',
        lesson: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p><strong>The six aspects:</strong> Heroism and Villainy appear on leaders only — they define the moral alignment of your deck. The four strategy aspects (Command, Aggression, Cunning, Vigilance) appear on regular cards and define your play style.</p>
                <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <li><strong>Command</strong> — board presence, resource advantage, big swings.</li>
                    <li><strong>Aggression</strong> — damage, removal, tempo attacks.</li>
                    <li><strong>Cunning</strong> — hand disruption, tricks, unexpected plays.</li>
                    <li><strong>Vigilance</strong> — defense, resilience, long-game setups.</li>
                </ul>
                <p><strong>Aspect-heavy vs. neutral builds:</strong> A deck built deep into one aspect is consistent but predictable. Neutral cards (no aspect icons) cost face value for anyone. Splashing a second aspect gives flexibility but raises your off-aspect risk.</p>
                <p><strong>Twin Suns vs. Premier:</strong> In Premier you have one leader. In Twin Suns you have two — which means you can legitimately cover two aspects without penalties and have more strategic identity to build around.</p>
            </div>
        ),
    },
    K4: {
        gate: 'Save ten decks.',
        lesson: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p><strong>Card advantage:</strong> The player who draws more cards (or makes their opponent discard) generates options. Cards that replace themselves (draw an extra card) or generate tokens are worth extra scrutiny.</p>
                <p><strong>Win conditions:</strong> Know what your deck is trying to do. Is it racing to kill the base with direct damage? Grinding with a wide board? Setting up one big turn with a deployed leader? Every card choice should either serve that plan or buy time to execute it.</p>
                <p><strong>Testing and iteration:</strong> Goldfish your deck alone to see if the curve works. Play practice games and note which cards are dead in your hand — those are cut candidates. Add one copy of a new card before committing to three. The Hand Simulator on this site is a fast way to check your opening hands without needing a partner.</p>
                <p><strong>Preparing for organized play:</strong> Know the format&apos;s current card pool, watch for recently added sets, and study the leading leader combinations. Familiarity with common strategies lets you build decks that answer the meta rather than simply following it.</p>
            </div>
        ),
    },
};

const RANK_ORDER = ['K1', 'K2', 'K3', 'K4'] as const;
const RANK_LABELS: Record<string, string> = { K1: 'Cadet', K2: 'Pilot', K3: 'Flight Lead', K4: 'Squadron' };
const CATEGORY_LABELS: Record<string, string> = {
    decks: 'Deck Building',
    collection: 'Collection',
    social: 'Social',
    training: 'Pilot Training',
};
const CATEGORY_ORDER = ['decks', 'collection', 'social', 'training'] as const;

function AchievementsTab({
    data,
    expandedRank,
    setExpandedRank,
}: {
    data: AchievementsResponse | null;
    expandedRank: string | null;
    setExpandedRank: (r: string | null) => void;
}) {
    const earnedSet = new Set(data?.achievements.filter(a => a.earned).map(a => a.key) ?? []);
    const currentRank = data?.rank ?? null;
    const totalPoints = data?.total_points ?? 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {/* ── Pilot Training ── */}
            <div>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--ts-line)',
                }}>
                    <div className="ts-eyebrow">Pilot Training</div>
                    {totalPoints > 0 && (
                        <span className="ts-chip" style={{ color: 'var(--ts-amber)' }}>
                            {totalPoints} pts
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {RANK_ORDER.map(rank => {
                        const rankKey = `rank_${rank.toLowerCase()}`;
                        const earned = earnedSet.has(rankKey);
                        const isExpanded = expandedRank === rank;
                        const isCurrent = currentRank === rank;
                        return (
                            <div key={rank} style={{
                                background: 'var(--ts-panel)',
                                border: `1px solid ${earned ? 'var(--ts-amber)' : 'var(--ts-line)'}`,
                                marginBottom: 8,
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 16px', cursor: 'pointer',
                                }} onClick={() => setExpandedRank(isExpanded ? null : rank)}>
                                    {/* Rank badge */}
                                    <AchievementBadge name={rankKey} size={48} locked={!earned} />
                                    {/* Label */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontFamily: 'var(--ts-font-display)', fontSize: 16,
                                            color: earned ? 'var(--ts-ink)' : 'var(--ts-ink-3)',
                                        }}>
                                            {RANK_LABELS[rank]}
                                            {isCurrent && (
                                                <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-amber)', marginLeft: 10, letterSpacing: '0.2em' }}>CURRENT</span>
                                            )}
                                        </div>
                                        <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-4)', marginTop: 2 }}>
                                            {RANK_LESSONS[rank].gate}
                                        </div>
                                    </div>
                                    {/* Status / toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                        {earned && <span style={{ color: 'var(--ts-green)', fontFamily: 'var(--ts-font-mono)', fontSize: 10 }}>✓</span>}
                                        <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-4)' }}>
                                            {isExpanded ? '▲' : '▼'} Lesson
                                        </span>
                                    </div>
                                </div>
                                {/* Lesson content */}
                                {isExpanded && (
                                    <div style={{
                                        padding: '0 16px 16px',
                                        fontFamily: 'var(--ts-font-body)', fontSize: 13,
                                        lineHeight: 1.75, color: 'var(--ts-ink-2)',
                                        borderTop: '1px solid var(--ts-line)',
                                        paddingTop: 14,
                                    }}>
                                        {RANK_LESSONS[rank].lesson}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Achievement grid ── */}
            <div>
                <div className="ts-eyebrow" style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--ts-line)' }}>
                    Achievements
                </div>
                {!data ? (
                    <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-4)' }}>
                        Loading…
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                        {CATEGORY_ORDER.map(cat => {
                            const items = data.achievements.filter(a => a.category === cat);
                            if (!items.length) return null;
                            return (
                                <div key={cat}>
                                    <div className="ts-eyebrow" style={{ marginBottom: 12, fontSize: 9, color: 'var(--ts-ink-4)' }}>
                                        {CATEGORY_LABELS[cat]}
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                        gap: 10,
                                    }}>
                                        {items.map(ach => (
                                            <div key={ach.key} style={{
                                                background: ach.earned ? 'var(--ts-panel)' : 'var(--ts-bg-2)',
                                                border: `1px solid ${ach.earned ? 'var(--ts-line-2)' : 'var(--ts-line)'}`,
                                                padding: '16px',
                                                position: 'relative',
                                            }}>
                                                {/* key label top-right */}
                                                <span style={{
                                                    position: 'absolute', top: 8, right: 10,
                                                    fontFamily: 'var(--ts-font-mono)', fontSize: 8,
                                                    color: 'var(--ts-ink-4)', letterSpacing: '0.16em',
                                                    textTransform: 'uppercase',
                                                }}>{ach.key}</span>

                                                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                                    <AchievementBadge name={ach.key} size={64} locked={!ach.earned} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                                                            <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 16, color: 'var(--ts-ink)', lineHeight: 1.2 }}>
                                                                {ach.title}
                                                            </div>
                                                            <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-amber)', flexShrink: 0 }}>
                                                                {ach.points} pts
                                                            </span>
                                                        </div>
                                                        <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-3)', lineHeight: 1.6 }}>
                                                            {ach.desc}
                                                        </div>
                                                        {ach.earned && ach.earned_at ? (
                                                            <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-green)', letterSpacing: '0.16em', marginTop: 8 }}>
                                                                ✓ {new Date(ach.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </div>
                                                        ) : (
                                                            <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-4)', letterSpacing: '0.14em', marginTop: 8 }}>
                                                                ◌ Locked
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── SecurityTab ─────────────────────────────────────────────────────────────

function SecurityTab({ onPasswordChanged }: { onPasswordChanged: () => Promise<void> }) {
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
    const [pwStatus, setPwStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [pwError, setPwError] = useState('');

    const [emailForm, setEmailForm] = useState({ current: '', newEmail: '' });
    const [emailStatus, setEmailStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [emailError, setEmailError] = useState('');

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pwForm.next !== pwForm.confirm) {
            setPwError('New passwords do not match.');
            setPwStatus('error');
            return;
        }
        if (pwForm.next.length < 8) {
            setPwError('New password must be at least 8 characters.');
            setPwStatus('error');
            return;
        }
        setPwStatus('saving');
        setPwError('');
        try {
            const res = await fetchWithAuth('/api/me/password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
            });
            if (res && typeof res === 'object' && 'detail' in res) {
                setPwError(String(res.detail));
                setPwStatus('error');
            } else {
                setPwStatus('success');
                setPwForm({ current: '', next: '', confirm: '' });
                await onPasswordChanged();
            }
        } catch {
            setPwError('Something went wrong. Please try again.');
            setPwStatus('error');
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailStatus('saving');
        setEmailError('');
        try {
            const res = await fetchWithAuth('/api/me/email', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: emailForm.current, new_email: emailForm.newEmail }),
            });
            if (res && typeof res === 'object' && 'detail' in res) {
                setEmailError(String(res.detail));
                setEmailStatus('error');
            } else {
                setEmailStatus('success');
                setEmailForm({ current: '', newEmail: '' });
            }
        } catch {
            setEmailError('Something went wrong. Please try again.');
            setEmailStatus('error');
        }
    };

    const fieldStyle: React.CSSProperties = {
        display: 'flex', flexDirection: 'column', gap: 6,
    };
    const labelStyle: React.CSSProperties = {
        fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em',
        textTransform: 'uppercase', color: 'var(--ts-ink-3)',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 520 }}>

            {/* ── Change Password ── */}
            <section>
                <div className="ts-eyebrow" style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--ts-line)' }}>
                    Change Password
                </div>

                {pwStatus === 'success' ? (
                    <div style={{ border: '1px solid var(--ts-green)', background: 'rgba(80,200,100,0.07)', padding: '16px 20px' }}>
                        <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-green)', letterSpacing: '0.1em' }}>
                            ✓ Password updated. All other sessions have been invalidated — you will be logged out momentarily.
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Current Password</label>
                            <input
                                type="password"
                                className="ts-input"
                                value={pwForm.current}
                                onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                                autoComplete="current-password"
                                required
                            />
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>New Password</label>
                            <input
                                type="password"
                                className="ts-input"
                                value={pwForm.next}
                                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                                autoComplete="new-password"
                                minLength={8}
                                required
                            />
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Confirm New Password</label>
                            <input
                                type="password"
                                className="ts-input"
                                value={pwForm.confirm}
                                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                                autoComplete="new-password"
                                required
                            />
                        </div>

                        {pwStatus === 'error' && (
                            <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-red)', letterSpacing: '0.08em' }}>
                                {pwError}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                className="ts-btn ts-btn-primary ts-btn-sm"
                                disabled={pwStatus === 'saving'}
                            >
                                {pwStatus === 'saving' ? 'Saving…' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                )}
            </section>

            {/* ── Change Email ── */}
            <section>
                <div className="ts-eyebrow" style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--ts-line)' }}>
                    Change Email Address
                </div>

                {emailStatus === 'success' ? (
                    <div style={{ border: '1px solid var(--ts-green)', background: 'rgba(80,200,100,0.07)', padding: '16px 20px' }}>
                        <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-green)', letterSpacing: '0.1em' }}>
                            ✓ Email updated. A verification link has been sent to your new address.
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Current Password</label>
                            <input
                                type="password"
                                className="ts-input"
                                value={emailForm.current}
                                onChange={e => setEmailForm(f => ({ ...f, current: e.target.value }))}
                                autoComplete="current-password"
                                required
                            />
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>New Email Address</label>
                            <input
                                type="email"
                                className="ts-input"
                                value={emailForm.newEmail}
                                onChange={e => setEmailForm(f => ({ ...f, newEmail: e.target.value }))}
                                autoComplete="email"
                                required
                            />
                        </div>

                        {emailStatus === 'error' && (
                            <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-red)', letterSpacing: '0.08em' }}>
                                {emailError}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                className="ts-btn ts-btn-primary ts-btn-sm"
                                disabled={emailStatus === 'saving'}
                            >
                                {emailStatus === 'saving' ? 'Saving…' : 'Update Email'}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}

// ── Main page ───────────────────────────────────────────────────────────────

const UserProfilePage = () => {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

    const [decks, setDecks] = useState<SavedDeck[]>([]);
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<UserProfileData>(user ? {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at || defaultUserProfile.createdAt,
    } : defaultUserProfile);
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTab, setSelectedTab] = useState('decks');
    const [formData, setFormData] = useState({ username: userProfile.username, avatarUrl: userProfile.avatarUrl || '' });
    const [error, setError] = useState<string | null>(null);
    const [showAllCards, setShowAllCards] = useState(false);
    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [achievementsData, setAchievementsData] = useState<AchievementsResponse | null>(null);
    const [expandedRank, setExpandedRank] = useState<string | null>(null);

    const loadData = async () => {
        setIsPageLoading(true);
        setError(null);

        try {

            let decksData = [];
            let collectionData = [];

            try {
                const fetchedDecks = await fetchWithAuth(`/api/decks`);
                if (Array.isArray(fetchedDecks)) {
                    decksData = fetchedDecks;

                } else if (fetchedDecks && typeof fetchedDecks === 'object' && fetchedDecks.detail) {

                    setError(fetchedDecks.detail);
                } else {

                    setError('Unexpected response format from server');
                }
            } catch (deckError) {
                console.error('[Profile] Error fetching decks:', deckError);
            }

            try {
                const collectionUrl = `/api/me/collection?all_cards=true`;
                const collectionResponse = await fetch(collectionUrl);
                if (collectionResponse.ok) {
                    collectionData = await collectionResponse.json();

                } else if (collectionResponse.status === 401) {

                    setError('Authentication required');
                } else {

                }
            } catch (collectionError) {
                console.error('[Profile] Error fetching collection:', collectionError);
            }

            let wishlistData: WishlistItem[] = [];
            try {
                const wishlistResponse = await fetch('/api/me/wishlist');
                if (wishlistResponse.ok) {
                    wishlistData = await wishlistResponse.json();
                }
            } catch (wishlistError) {
                console.error('[Profile] Error fetching wishlist:', wishlistError);
            }

            let achievementsResult: AchievementsResponse | null = null;
            try {
                achievementsResult = await fetchUserAchievements();
            } catch (achError) {
                console.error('[Profile] Error fetching achievements:', achError);
            }

            setDecks(decksData);
            setCollection(collectionData);
            setWishlist(wishlistData);
            setAchievementsData(achievementsResult);
        } catch (err) {
            console.error('[Profile] Error loading profile data:', err);
            setError('Failed to load profile data. Please check your connection and try again.');
        } finally {
            setIsPageLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            loadData();
        }
    }, [isAuthenticated, authLoading]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, authLoading, router]);

    useEffect(() => {
        if (user) {
            setUserProfile({
                id: user.id,
                username: user.username,
                avatarUrl: user.avatar_url,
                createdAt: user.created_at || defaultUserProfile.createdAt,
            });
            setFormData({ username: user.username, avatarUrl: user.avatar_url || '' });
        }
    }, [user]);

    const handleEditProfile = () => setIsEditing(true);
    const handleSaveProfile = async () => {
        try {
            await fetchWithAuth('/api/me/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar_url: formData.avatarUrl || null }),
            });
            setUserProfile({ ...userProfile, username: formData.username, avatarUrl: formData.avatarUrl || undefined });
        } catch (err) {
            console.error('Error saving profile:', err);
        }
        setIsEditing(false);
    };
    const handleCancelEdit = () => {
        setFormData({ username: userProfile.username, avatarUrl: userProfile.avatarUrl || '' });
        setIsEditing(false);
    };

    const handleDeleteDeck = async (deckId: string) => {
        if (window.confirm('Are you sure you want to delete this deck?')) {
            try {
                const success = await deleteUserDeck(deckId);
                if (success) {
                    setDecks(decks.filter(deck => deck.id !== deckId));
                } else {
                    throw new Error('Failed to delete deck');
                }
            } catch (err) {
                console.error('Error deleting deck:', err);
                alert('Failed to delete deck. Please try again.');
            }
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleRemoveFromWishlist = async (cardId: string) => {
        try {
            const res = await fetch(`/api/me/wishlist/${cardId}`, { method: 'DELETE' });
            if (res.ok || res.status === 204) {
                setWishlist(prev => prev.filter(item => item.card.id !== cardId));
            }
        } catch (err) {
            console.error('Error removing from wishlist:', err);
        }
    };

    const handleResendVerification = async () => {
        if (!user?.username || resendStatus !== 'idle') return;
        setResendStatus('sending');
        try {
            await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username }),
            });
        } catch (err) {
            console.error('Error resending verification:', err);
        }
        setResendStatus('sent');
    };

    const handlePasswordChanged = useCallback(async () => {
        // Token version is bumped on password change — log out after a brief delay
        // so the user sees the success message before being redirected.
        setTimeout(async () => {
            await logout();
            router.push('/login');
        }, 2500);
    }, [logout, router]);

    const handleAddToCollection = async (cardId: string, quantity: number = 1) => {
        try {
            await fetchWithAuth('/api/me/collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ card_id: cardId, count: quantity }),
            });
            loadData();
        } catch (err) {
            console.error('Error updating collection:', err);
        }
    };

    const ownedCount = collection.filter(item => item.in_collection).length;
    const totalCount = collection.length;
    const completionPct = totalCount > 0 ? ((ownedCount / totalCount) * 100).toFixed(1) : null;

    const filteredCollection = collection.filter(item =>
        (showAllCards || item.in_collection) &&
        item.card.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ minHeight: '100vh', background: 'var(--ts-bg)' }}>

            {/* ── Profile Header ─────────────────────────────────────── */}
            <header style={{ background: 'var(--ts-panel)', borderBottom: '1px solid var(--ts-line)' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

                        {/* Avatar square */}
                        <div style={{ width: 56, height: 56, background: 'var(--ts-bg-3)', border: '1px solid var(--ts-line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                            {userProfile.avatarUrl ? (
                                <img
                                    src={userProfile.avatarUrl}
                                    alt={userProfile.username}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <span style={{ fontFamily: 'var(--ts-font-display)', fontSize: 22, color: 'var(--ts-amber)' }}>
                                    {userProfile.username.substring(0, 2).toUpperCase()}
                                </span>
                            )}
                        </div>

                        {/* Name + member since */}
                        <div>
                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleInputChange}
                                        className="ts-input"
                                        style={{ fontSize: 18, padding: '4px 10px', width: 'auto' }}
                                    />
                                    <input
                                        type="url"
                                        name="avatarUrl"
                                        value={formData.avatarUrl}
                                        onChange={handleInputChange}
                                        placeholder="Avatar image URL (optional)"
                                        className="ts-input"
                                        style={{ fontSize: 12, padding: '4px 10px', width: 260 }}
                                    />
                                </div>
                            ) : (
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink)', lineHeight: 1.1 }}>
                                    {userProfile.username}
                                </div>
                            )}
                            <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-4)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 4 }}>
                                Member Since {new Date(userProfile.createdAt).toLocaleDateString()}
                            </div>
                        </div>

                        {/* Collection completion stat */}
                        {completionPct !== null && (
                            <div style={{ marginLeft: 8, padding: '10px 18px', background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--ts-ink-4)', textTransform: 'uppercase' }}>
                                    Collection
                                </div>
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 22, color: 'var(--ts-amber)', lineHeight: 1 }}>
                                    {completionPct}%
                                </div>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', letterSpacing: '0.1em' }}>
                                    {ownedCount} / {totalCount} cards
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Edit controls */}
                    {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleSaveProfile} className="ts-btn ts-btn-sm" style={{ borderColor: 'var(--ts-green)', color: 'var(--ts-green)' }}>
                                Save
                            </button>
                            <button onClick={handleCancelEdit} className="ts-btn ts-btn-sm">
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleEditProfile} className="ts-btn ts-btn-sm">
                            Edit Profile
                        </button>
                    )}
                </div>
            </header>

            {/* ── Email verification banner ──────────────────────────── */}
            {user?.email && !user.email_verified && (
                <div style={{ background: 'rgba(255,180,0,0.08)', borderBottom: '1px solid rgba(255,180,0,0.3)', padding: '10px 32px' }}>
                    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-amber)', letterSpacing: '0.1em' }}>
                            Your email address is unverified. Check your inbox for a verification link.
                        </div>
                        <button
                            onClick={handleResendVerification}
                            disabled={resendStatus !== 'idle'}
                            className="ts-btn ts-btn-sm"
                            style={{ borderColor: 'var(--ts-amber)', color: 'var(--ts-amber)', opacity: resendStatus !== 'idle' ? 0.6 : 1 }}
                        >
                            {resendStatus === 'idle' ? 'Resend link' : resendStatus === 'sending' ? 'Sending...' : 'Sent'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Main Content ───────────────────────────────────────── */}
            <main style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px' }}>
                <Tabs defaultValue="decks" className="w-full" onValueChange={setSelectedTab}>

                    <TabsList className="ts-tabs-list" style={{ marginBottom: 32 }}>
                        <TabsTrigger value="decks" className="ts-tab-trigger">My Decks</TabsTrigger>
                        <TabsTrigger value="collection" className="ts-tab-trigger">My Collection</TabsTrigger>
                        <TabsTrigger value="achievements" className="ts-tab-trigger">Achievements</TabsTrigger>
                        <TabsTrigger value="tournaments" className="ts-tab-trigger">Tournaments</TabsTrigger>
                        <TabsTrigger value="wishlist" className="ts-tab-trigger">Wishlist</TabsTrigger>
                        <TabsTrigger value="security" className="ts-tab-trigger">Security</TabsTrigger>
                    </TabsList>

                    {/* ── Decks ──────────────────────────────────────── */}
                    <TabsContent value="decks">
                        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Command Center</div>
                                <h2>My Decks</h2>
                            </div>
                            <Link href="/deck-builder" className="ts-btn ts-btn-primary ts-btn-sm" style={{ textDecoration: 'none' }}>
                                + New Deck
                            </Link>
                        </div>

                        {error && selectedTab === 'decks' ? (
                            <div style={{ border: '1px solid var(--ts-red)', background: 'rgba(255,61,46,0.07)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ts-red)' }}>Error</div>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 12, color: 'var(--ts-ink-2)' }}>{error}</div>
                                <button onClick={loadData} className="ts-btn ts-btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Retry</button>
                            </div>
                        ) : isPageLoading ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} style={{ border: '1px solid var(--ts-line)', padding: 16, background: 'var(--ts-bg-2)' }}>
                                        <div className="ts-skeleton" style={{ height: 14, width: '60%', marginBottom: 10 }} />
                                        <div className="ts-skeleton" style={{ height: 9, width: '35%', marginBottom: 16 }} />
                                        <div className="ts-skeleton" style={{ height: 80 }} />
                                    </div>
                                ))}
                            </div>
                        ) : decks.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                                {decks.map(deck => (
                                    <DeckCard key={deck.id} deck={deck} onDelete={handleDeleteDeck} />
                                ))}
                            </div>
                        ) : (
                            <div style={{ border: '1px solid var(--ts-line)', background: 'var(--ts-bg-2)', padding: '64px 32px', textAlign: 'center' }}>
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink-3)', marginBottom: 12 }}>
                                    No decks yet.
                                </div>
                                <p style={{ color: 'var(--ts-ink-3)', fontSize: 13, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
                                    Build your first Twin Suns deck to get started.
                                </p>
                                <Link href="/deck-builder" className="ts-btn ts-btn-primary" style={{ textDecoration: 'none' }}>
                                    Build a Deck →
                                </Link>
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Collection ─────────────────────────────────── */}
                    <TabsContent value="collection">
                        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Inventory</div>
                                <h2>My Collection</h2>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                {/* Show-all toggle */}
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--ts-font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ts-ink-3)' }}>
                                    <input
                                        type="checkbox"
                                        checked={showAllCards}
                                        onChange={e => setShowAllCards(e.target.checked)}
                                        style={{ accentColor: 'var(--ts-amber)', width: 14, height: 14 }}
                                    />
                                    Show All Cards
                                </label>

                                <input
                                    type="text"
                                    placeholder="Search collection…"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="ts-input"
                                    style={{ width: 220, padding: '7px 12px', fontSize: 13 }}
                                />

                                <Link href="/cards" className="ts-btn ts-btn-primary ts-btn-sm" style={{ textDecoration: 'none' }}>
                                    + Add Cards
                                </Link>
                            </div>
                        </div>

                        {error && selectedTab === 'collection' ? (
                            <div style={{ border: '1px solid var(--ts-red)', background: 'rgba(255,61,46,0.07)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ts-red)' }}>Error</div>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 12, color: 'var(--ts-ink-2)' }}>{error}</div>
                                <button onClick={loadData} className="ts-btn ts-btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Retry</button>
                            </div>
                        ) : isPageLoading ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <div key={i} style={{ border: '1px solid var(--ts-line)', overflow: 'hidden' }}>
                                        <div className="ts-skeleton" style={{ aspectRatio: '2/3', width: '100%' }} />
                                        <div style={{ padding: '6px 8px', background: 'var(--ts-bg-2)' }}>
                                            <div className="ts-skeleton" style={{ height: 9, width: '65%' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredCollection.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                                {filteredCollection.map(item => (
                                    <CollectionCard
                                        key={item.card.id}
                                        collectionItem={item}
                                        onAddToCollection={handleAddToCollection}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div style={{ border: '1px solid var(--ts-line)', background: 'var(--ts-bg-2)', padding: '64px 32px', textAlign: 'center' }}>
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink-3)', marginBottom: 12 }}>
                                    {searchTerm ? `No cards matching "${searchTerm}".` : 'Collection is empty.'}
                                </div>
                                {!searchTerm && (
                                    <Link href="/cards" className="ts-btn ts-btn-primary" style={{ textDecoration: 'none' }}>
                                        Browse Cards →
                                    </Link>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Achievements ─────────────────────────────────── */}
                    <TabsContent value="achievements">
                        <AchievementsTab
                            data={achievementsData}
                            expandedRank={expandedRank}
                            setExpandedRank={setExpandedRank}
                        />
                    </TabsContent>

                    {/* ── Tournaments — Coming Soon ───────────────────── */}
                    <TabsContent value="tournaments">
                        <ComingSoonPanel
                            title="Tournament History"
                            description="Track your event results, ELO rating, and head-to-head records. Requires a tournament-reporting integration — planned for a future release."
                            features={[
                                'Event results with placement and record',
                                'ELO / ranking history over time',
                                'Head-to-head records vs opponents',
                                'Deck used per event with performance breakdown',
                            ]}
                        />
                    </TabsContent>

                    {/* ── Wishlist ─────────────────────────────────────── */}
                    <TabsContent value="wishlist">
                        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Acquisition List</div>
                                <h2>Wishlist</h2>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {wishlist.length > 0 && (
                                    <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-3)', letterSpacing: '0.14em' }}>
                                        {wishlist.length} {wishlist.length === 1 ? 'card' : 'cards'}
                                    </div>
                                )}
                                <Link href="/cards" className="ts-btn ts-btn-primary ts-btn-sm" style={{ textDecoration: 'none' }}>
                                    + Browse Cards
                                </Link>
                            </div>
                        </div>

                        {isPageLoading ? (
                            <div style={{ textAlign: 'center', padding: '64px 0', fontFamily: 'var(--ts-font-mono)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--ts-ink-3)' }}>
                                LOADING…
                            </div>
                        ) : wishlist.length === 0 ? (
                            <div style={{ border: '1px solid var(--ts-line)', padding: '64px 32px', textAlign: 'center', background: 'var(--ts-bg-2)' }}>
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink-3)', marginBottom: 12 }}>
                                    Nothing on the list yet.
                                </div>
                                <p style={{ color: 'var(--ts-ink-3)', fontSize: 13, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
                                    Browse the card catalogue and add cards you're hunting to your wishlist.
                                </p>
                                <Link href="/cards" className="ts-btn ts-btn-primary" style={{ textDecoration: 'none' }}>
                                    Browse Cards →
                                </Link>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                                {wishlist.map(item => (
                                    <WishlistCard key={item.card.id} item={item} onRemove={handleRemoveFromWishlist} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Security ─────────────────────────────────────── */}
                    <TabsContent value="security">
                        <div style={{ marginBottom: 28 }}>
                            <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Account</div>
                            <h2>Security Settings</h2>
                        </div>
                        <SecurityTab onPasswordChanged={handlePasswordChanged} />
                    </TabsContent>

                </Tabs>
            </main>
        </div>
    );
};

export default UserProfilePage;
