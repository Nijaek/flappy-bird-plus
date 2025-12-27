// src/components/ShopModal.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import './ShopModal.css';

interface ShopModalProps {
  onClose: () => void;
  isAuthenticated: boolean;
}

interface ShopItem {
  id: string;
  sku: string;
  name: string;
  type: 'skin' | 'trail';
  price: number;
  owned: boolean;
  equipped: boolean;
}

type TabType = 'skins' | 'trails';

export default function ShopModal({ onClose, isAuthenticated }: ShopModalProps) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('skins');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch items and balance
  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, userRes] = await Promise.all([
        fetch('/api/shop/items'),
        isAuthenticated ? fetch('/api/users/me') : Promise.resolve(null),
      ]);

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.items);
      } else {
        setError('Failed to load shop items');
      }

      if (userRes?.ok) {
        const data = await userRes.json();
        setBalance(data.user?.pointsBalance ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch shop data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleItemClick = async (item: ShopItem) => {
    setError(null);

    if (!isAuthenticated) {
      setError('Sign in to purchase items');
      return;
    }

    // If owned, equip/unequip
    if (item.owned) {
      if (item.equipped) {
        // Unequip (only trails can be unequipped)
        if (item.type === 'trail') {
          try {
            const res = await fetch('/api/shop/equip', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemId: null, type: 'trail' }),
            });
            if (res.ok) {
              await fetchData();
            }
          } catch (err) {
            console.error('Unequip failed:', err);
          }
        }
        return;
      }

      // Equip
      try {
        const res = await fetch('/api/shop/equip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, type: item.type }),
        });
        if (res.ok) {
          await fetchData();
        }
      } catch (err) {
        console.error('Equip failed:', err);
      }
      return;
    }

    // Not owned - purchase flow
    if (selectedId === item.id) {
      // Second tap - confirm purchase
      if (balance < item.price) {
        setError('Not enough points!');
        setSelectedId(null);
        return;
      }

      try {
        const res = await fetch('/api/shop/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id }),
        });

        if (res.ok) {
          const data = await res.json();
          setBalance(data.newBalance);
          await fetchData();
          setSelectedId(null);
        } else {
          const data = await res.json();
          setError(data.error?.message || 'Purchase failed');
          setSelectedId(null);
        }
      } catch (err) {
        console.error('Purchase failed:', err);
        setError('Purchase failed');
        setSelectedId(null);
      }
    } else {
      // First tap - select
      if (balance < item.price) {
        setError('Not enough points!');
        return;
      }
      setSelectedId(item.id);
    }
  };

  const filteredItems = items.filter(item =>
    activeTab === 'skins' ? item.type === 'skin' : item.type === 'trail'
  );

  if (isLoading) {
    return (
      <div className="shop-overlay" onClick={onClose}>
        <div className="shop-modal" onClick={e => e.stopPropagation()}>
          <div className="shop-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-overlay" onClick={onClose}>
      <div className="shop-modal" onClick={e => e.stopPropagation()}>
        <button className="shop-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="shop-header">
          <h1 className="shop-title">SHOP</h1>
          <div className="shop-balance">★ {balance}</div>
        </div>

        <div className="shop-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'skins'}
            className={`shop-tab ${activeTab === 'skins' ? 'active' : ''}`}
            onClick={() => { setActiveTab('skins'); setSelectedId(null); setError(null); }}
          >
            SKINS
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'trails'}
            className={`shop-tab ${activeTab === 'trails' ? 'active' : ''}`}
            onClick={() => { setActiveTab('trails'); setSelectedId(null); setError(null); }}
          >
            TRAILS
          </button>
        </div>

        {error && <div className="shop-error">{error}</div>}

        <div className="shop-content">
          <div className="shop-grid">
            {filteredItems.map(item => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className={`shop-item ${selectedId === item.id ? 'selected' : ''} ${item.equipped ? 'equipped' : ''}`}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
              >
                <div className="shop-item-preview">
                  <ItemPreview item={item} />
                </div>
                <div className="shop-item-name">{item.name}</div>
                <div className={`shop-item-price ${item.owned ? (item.equipped ? 'equipped' : 'owned') : ''}`}>
                  {item.equipped ? 'EQUIPPED' : item.owned ? 'OWNED' : `★ ${item.price}`}
                </div>
                {selectedId === item.id && !item.owned && (
                  <div className="shop-buy-prompt">TAP TO BUY</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Preview component for items
function ItemPreview({ item }: { item: ShopItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 60, 60);

    if (item.type === 'skin') {
      // Draw a simple colored circle for skin preview
      const colors: Record<string, string> = {
        skin_yellow: '#F8E848',
        skin_blue: '#68C8D8',
        skin_red: '#E85858',
        skin_rainbow: 'rainbow',
      };

      const color = colors[item.sku] || '#F8E848';

      if (color === 'rainbow') {
        // Draw rainbow gradient
        const gradient = ctx.createLinearGradient(15, 15, 45, 45);
        gradient.addColorStop(0, '#FF0000');
        gradient.addColorStop(0.2, '#FF7F00');
        gradient.addColorStop(0.4, '#FFFF00');
        gradient.addColorStop(0.6, '#00FF00');
        gradient.addColorStop(0.8, '#0000FF');
        gradient.addColorStop(1, '#9400D3');
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = color;
      }

      // Draw bird body shape (simplified)
      ctx.beginPath();
      ctx.ellipse(30, 30, 15, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(36, 26, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(38, 26, 3, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#F88028';
      ctx.fillRect(42, 28, 8, 4);
      ctx.fillStyle = '#D85020';
      ctx.fillRect(42, 32, 8, 4);
    } else {
      // Trail preview - draw particles
      const particleColors: Record<string, string[]> = {
        trail_sparkles: ['#FFD700', '#FFEC8B', '#FFF8DC'],
        trail_bubbles: ['#87CEEB', '#ADD8E6', '#B0E0E6'],
        trail_fire: ['#FF4500', '#FF6347', '#FFA500'],
        trail_stars: ['#FFD700', '#FFA500', '#FFFFFF'],
        trail_rainbow: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#9400D3'],
      };

      const colors = particleColors[item.sku] || ['#FFFFFF'];

      for (let i = 0; i < 12; i++) {
        const x = 10 + ((i * 17 + 5) % 40);
        const y = 10 + ((i * 13 + 7) % 40);
        const size = 2 + (i % 3) * 2;
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.6 + (i % 4) * 0.1;

        if (item.sku === 'trail_stars') {
          // Draw star shape
          drawStar(ctx, x, y, size);
        } else if (item.sku === 'trail_bubbles') {
          // Draw circle
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Draw square
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
    }
  }, [item]);

  return <canvas ref={canvasRef} width={60} height={60} />;
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillRect(x - size / 2, y - 1, size, 2);
  ctx.fillRect(x - 1, y - size / 2, 2, size);
}
