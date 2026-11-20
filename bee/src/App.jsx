import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  Banknote,
  Box,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Eye,
  Gift as GiftIcon,
  Grid2X2,
  Headphones,
  Heart,
  Home as HomeIcon,
  Layers3,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Package,
  PartyPopper,
  PencilLine,
  Phone,
  Plus,
  Printer,
  Quote,
  RotateCcw,
  Ruler,
  Search,
  Send,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Truck,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  Link,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { categories, faqs, money, products, testimonials } from './data';

const StoreContext = createContext(null);
const useStore = () => useContext(StoreContext);

function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('beebazar-cart')) || [];
    } catch {
      return [];
    }
  });
  const [wishlist, setWishlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('beebazar-wishlist')) || [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => localStorage.setItem('beebazar-cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('beebazar-wishlist', JSON.stringify(wishlist)), [wishlist]);

  const notify = (message, kind = 'success') => {
    setToast({ message, kind, key: Date.now() });
    window.clearTimeout(window.__beeToast);
    window.__beeToast = window.setTimeout(() => setToast(null), 2800);
  };

  const getUnitPrice = (product, qty = 1) => {
    const tier = [...(product.wholesale || [])]
      .sort((a, b) => b.min - a.min)
      .find((item) => qty >= item.min);
    return tier?.price || product.price;
  };

  const addToCart = (product, options = {}) => {
    const qty = Math.max(1, Number(options.qty) || 1);
    const size = options.size || product.sizes?.[0] || '';
    const color = options.color || product.colors?.[0] || '';
    const customText = options.customText?.trim() || '';
    const key = `${product.id}-${size}-${color}-${customText}`;
    setCart((current) => {
      const found = current.find((item) => item.key === key);
      if (found) {
        return current.map((item) => (item.key === key ? { ...item, qty: item.qty + qty } : item));
      }
      return [...current, { key, productId: product.id, qty, size, color, customText }];
    });
    notify(`${product.title} ব্যাগে যোগ হয়েছে`);
    if (options.openCart !== false) setCartOpen(true);
  };

  const updateQty = (key, qty) => {
    if (qty < 1) return setCart((current) => current.filter((item) => item.key !== key));
    setCart((current) => current.map((item) => (item.key === key ? { ...item, qty } : item)));
  };

  const removeFromCart = (key) => {
    setCart((current) => current.filter((item) => item.key !== key));
    notify('পণ্যটি ব্যাগ থেকে সরানো হয়েছে', 'neutral');
  };

  const toggleWishlist = (id) => {
    const liked = wishlist.includes(id);
    setWishlist((current) => (liked ? current.filter((item) => item !== id) : [...current, id]));
    notify(liked ? 'Wishlist থেকে সরানো হয়েছে' : 'পছন্দের তালিকায় রাখা হলো', liked ? 'neutral' : 'love');
  };

  const clearCart = () => setCart([]);

  const cartLines = cart.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const unitPrice = product ? getUnitPrice(product, item.qty) : 0;
    return { ...item, product, unitPrice, lineTotal: unitPrice * item.qty };
  }).filter((item) => item.product);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cartLines.reduce((sum, item) => sum + item.lineTotal, 0);

  const value = {
    cart,
    cartLines,
    cartCount,
    subtotal,
    wishlist,
    cartOpen,
    searchOpen,
    accountOpen,
    mobileOpen,
    toast,
    setCartOpen,
    setSearchOpen,
    setAccountOpen,
    setMobileOpen,
    addToCart,
    updateQty,
    removeFromCart,
    toggleWishlist,
    clearCart,
    getUnitPrice,
    notify,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function Logo({ light = false, compact = false }) {
  return (
    <Link to="/" className={`brand-logo ${light ? 'brand-logo--light' : ''}`} aria-label="BeeBazar home">
      <svg viewBox="0 0 52 52" role="img" aria-hidden="true">
        <path className="logo-wing logo-wing--left" d="M22 21C12 19 7 11 12 7c5-4 12 3 14 11" />
        <path className="logo-wing logo-wing--right" d="M30 21c10-2 15-10 10-14-5-4-12 3-14 11" />
        <ellipse className="logo-body" cx="26" cy="29" rx="11" ry="14" />
        <path className="logo-stripe" d="M17 25h18M16 31h20" />
        <path className="logo-smile" d="M22 35c2 2 6 2 8 0" />
        <circle className="logo-eye" cx="22" cy="25" r="1.2" />
        <circle className="logo-eye" cx="30" cy="25" r="1.2" />
        <path className="logo-sting" d="M26 43v4" />
      </svg>
      {!compact && (
        <span className="brand-word">
          <strong>Bee</strong>Bazar
          <small>made with a little more care</small>
        </span>
      )}
    </Link>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` }}>
      {children}
    </Tag>
  );
}

function AnnouncementBar() {
  return (
    <div className="announcement">
      <div className="shell announcement__inner">
        <span className="announcement__main"><Sparkles size={15} /> ৳২,০০০+ অর্ডারে ঢাকায় delivery আমাদের তরফ থেকে</span>
        <span className="announcement__side">কথা বলুন <a href="tel:+8801700000000">০১৭০০ ০০০ ০০০</a></span>
      </div>
    </div>
  );
}

function Header() {
  const {
    cartCount,
    wishlist,
    setCartOpen,
    setSearchOpen,
    setAccountOpen,
    mobileOpen,
    setMobileOpen,
  } = useStore();
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname, setMobileOpen]);

  return (
    <>
      <AnnouncementBar />
      <header className="site-header">
        <div className="shell header-main">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Menu খুলুন">
            <Menu size={23} />
          </button>
          <Logo />
          <nav className="main-nav" aria-label="Main navigation">
            <NavLink to="/" end>হোম</NavLink>
            <NavLink to="/shop">দোকান</NavLink>
            <NavLink to="/customize">নিজের মতো বানান <span className="nav-new">fun</span></NavLink>
            <a href="/#story">আমাদের গল্প</a>
          </nav>
          <button className="header-search" onClick={() => setSearchOpen(true)}>
            <Search size={18} />
            <span>কী খুঁজছেন?</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="header-actions">
            <button className="location-button" title="Delivery location">
              <MapPin size={18} />
              <span><small>Delivery to</small>ঢাকা</span>
              <ChevronDown size={14} />
            </button>
            <button className="icon-button desktop-only-icon" onClick={() => setAccountOpen(true)} aria-label="Account">
              <User size={21} />
            </button>
            <Link to="/shop?liked=1" className="icon-button desktop-only-icon" aria-label="Wishlist">
              <Heart size={21} fill={wishlist.length ? 'currentColor' : 'none'} />
              {wishlist.length > 0 && <span className="action-count">{wishlist.length}</span>}
            </Link>
            <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Shopping bag, ${cartCount} items`}>
              <ShoppingBag size={21} />
              <span className="bag-button__label">ব্যাগ</span>
              <span className="bag-count">{cartCount}</span>
            </button>
          </div>
        </div>
        <div className="category-nav-wrap">
          <div className="shell category-nav">
            <span className="category-nav__label"><Grid2X2 size={16} /> সব বিভাগ</span>
            {categories.map((category) => (
              <Link key={category.id} to={`/shop?category=${category.id}`}>{category.name}</Link>
            ))}
            <Link className="category-nav__deal" to="/shop?sort=deal">আজকের মধুর Deal <ArrowRight size={15} /></Link>
          </div>
        </div>
      </header>
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

function MobileMenu({ open, onClose }) {
  const { setSearchOpen, setAccountOpen } = useStore();
  return (
    <div className={`mobile-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Menu বন্ধ করুন" />
      <aside className="mobile-drawer__panel">
        <div className="drawer-head"><Logo /><button className="icon-button" onClick={onClose}><X size={22} /></button></div>
        <button className="mobile-search" onClick={() => { onClose(); setSearchOpen(true); }}><Search size={19} /> কী খুঁজছেন?</button>
        <nav className="mobile-links">
          <NavLink to="/">হোম <ChevronRight size={18} /></NavLink>
          <NavLink to="/shop">সব পণ্য <ChevronRight size={18} /></NavLink>
          <NavLink to="/customize">নিজের মতো বানান <Sparkles size={18} /></NavLink>
        </nav>
        <p className="drawer-kicker">দোকানের তাক</p>
        <div className="mobile-categories">
          {categories.map((category) => (
            <Link key={category.id} to={`/shop?category=${category.id}`}>
              <span className="mobile-category-dot" style={{ background: category.tone }} />
              <span><strong>{category.name}</strong><small>{category.blurb}</small></span>
              <ChevronRight size={17} />
            </Link>
          ))}
        </div>
        <div className="mobile-account-card">
          <div className="mobile-account-icon"><User size={21} /></div>
          <div><strong>আপনার BeeBazar</strong><small>অর্ডার, Wishlist ও আরও অনেক</small></div>
          <button onClick={() => { onClose(); setAccountOpen(true); }}>ঢুকুন</button>
        </div>
      </aside>
    </div>
  );
}

function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useStore();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 100);
    else setQuery('');
  }, [searchOpen]);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSearchOpen]);

  const matches = query.trim()
    ? products.filter((p) => `${p.title} ${p.short}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : products.slice(0, 4);

  const goSearch = (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    setSearchOpen(false);
    navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className={`search-overlay ${searchOpen ? 'is-open' : ''}`} aria-hidden={!searchOpen}>
      <button className="search-overlay__backdrop" onClick={() => setSearchOpen(false)} aria-label="Search বন্ধ করুন" />
      <div className="search-panel">
        <div className="search-panel__top">
          <Logo compact />
          <form className="search-field" onSubmit={goSearch}>
            <Search size={22} />
            <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="হুডি, গিফট বক্স, ভিজিটিং কার্ড..." />
            {query && <button type="button" onClick={() => setQuery('')}><X size={18} /></button>}
          </form>
          <button className="search-close" onClick={() => setSearchOpen(false)}>বন্ধ</button>
        </div>
        <div className="search-content">
          <p className="search-caption">{query ? `“${query}” এর জন্য` : 'মানুষ এখন যেগুলো পছন্দ করছে'}</p>
          <div className="search-results">
            {matches.map((product) => (
              <Link key={product.id} to={`/product/${product.slug}`} onClick={() => setSearchOpen(false)}>
                <img src={product.image} alt="" style={{ objectPosition: product.imagePosition }} />
                <span><strong>{product.title}</strong><small>{product.short}</small></span>
                <b>{money(product.price)}</b>
                <ChevronRight size={18} />
              </Link>
            ))}
            {matches.length === 0 && (
              <div className="empty-search"><Search size={28} /><strong>এখনও কিছু পাওয়া গেল না</strong><span>বানান বদলে দেখুন, অথবা custom order করুন।</span></div>
            )}
          </div>
          <div className="quick-searches"><span>দ্রুত খুঁজুন</span>{['জার্সি', 'উপহার', 'ব্যানার', 'Bulk order'].map((x) => <button key={x} onClick={() => setQuery(x)}>{x}</button>)}</div>
        </div>
      </div>
    </div>
  );
}

function AccountModal() {
  const { accountOpen, setAccountOpen, notify } = useStore();
  const [mode, setMode] = useState('login');
  const submit = (event) => {
    event.preventDefault();
    notify(mode === 'login' ? 'Demo account-এ স্বাগতম!' : 'আপনার demo account তৈরি হয়েছে');
    setAccountOpen(false);
  };
  return (
    <div className={`modal-shell ${accountOpen ? 'is-open' : ''}`} aria-hidden={!accountOpen}>
      <button className="modal-backdrop" onClick={() => setAccountOpen(false)} aria-label="বন্ধ করুন" />
      <div className="account-modal">
        <button className="modal-close icon-button" onClick={() => setAccountOpen(false)}><X size={20} /></button>
        <div className="account-art">
          <div className="account-art__hive"><span>অর্ডার</span><span>পছন্দ</span><span>আনন্দ</span></div>
          <Sparkles size={28} />
          <h3>আপনার ছোট্ট<br />BeeBazar corner</h3>
          <p>অর্ডার খুঁজুন, পছন্দ জমিয়ে রাখুন আর custom design-এর খবর পান।</p>
        </div>
        <form className="account-form" onSubmit={submit}>
          <span className="eyebrow">WELCOME HOME</span>
          <h2>{mode === 'login' ? 'আবার দেখা হলো!' : 'চলুন পরিচিত হই'}</h2>
          <p>{mode === 'login' ? 'আপনার ফোন নম্বর দিয়ে demo account-এ ঢুকুন।' : 'মাত্র এক মিনিটেই account তৈরি করুন।'}</p>
          {mode === 'register' && <label>আপনার নাম<input required placeholder="যেমন, তানজিম রহমান" /></label>}
          <label>মোবাইল নম্বর<div className="phone-input"><span>+৮৮</span><input required inputMode="tel" placeholder="০১XXXXXXXXX" /></div></label>
          <button className="button button--dark button--wide" type="submit">{mode === 'login' ? 'এগিয়ে যাই' : 'Account তৈরি করুন'} <ArrowRight size={18} /></button>
          <div className="or-rule"><span>অথবা</span></div>
          <button type="button" className="social-login"><Mail size={18} /> Email দিয়ে চালিয়ে যান</button>
          <p className="account-switch">{mode === 'login' ? 'এখানে নতুন?' : 'আগেই account আছে?'} <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Account খুলুন' : 'Login করুন'}</button></p>
        </form>
      </div>
    </div>
  );
}

function CartDrawer() {
  const { cartOpen, setCartOpen, cartLines, subtotal, updateQty, removeFromCart } = useStore();
  const navigate = useNavigate();
  const freeGap = Math.max(0, 2000 - subtotal);
  const progress = Math.min(100, (subtotal / 2000) * 100);
  return (
    <div className={`cart-drawer ${cartOpen ? 'is-open' : ''}`} aria-hidden={!cartOpen}>
      <button className="drawer-backdrop" onClick={() => setCartOpen(false)} aria-label="ব্যাগ বন্ধ করুন" />
      <aside className="cart-panel">
        <div className="cart-head">
          <div><span className="eyebrow">YOUR BAG</span><h2>আনন্দের ব্যাগ <small>{cartLines.reduce((s, x) => s + x.qty, 0)}</small></h2></div>
          <button className="icon-button" onClick={() => setCartOpen(false)}><X size={22} /></button>
        </div>
        {cartLines.length > 0 ? (
          <>
            <div className="shipping-progress">
              <div className="shipping-progress__icon"><Truck size={19} /></div>
              <div><p>{freeGap > 0 ? <><strong>{money(freeGap)}</strong> আর হলেই ঢাকায় free delivery</> : <><strong>ইয়েই!</strong> Free delivery unlock হয়েছে</>}</p><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>
            </div>
            <div className="cart-items">
              {cartLines.map((item) => (
                <article className="cart-item" key={item.key}>
                  <Link to={`/product/${item.product.slug}`} onClick={() => setCartOpen(false)} className="cart-item__image"><img src={item.product.image} alt={item.product.title} style={{ objectPosition: item.product.imagePosition }} /></Link>
                  <div className="cart-item__body">
                    <div className="cart-item__title"><Link to={`/product/${item.product.slug}`} onClick={() => setCartOpen(false)}>{item.product.title}</Link><button onClick={() => removeFromCart(item.key)} aria-label="Remove"><Trash2 size={17} /></button></div>
                    <p>{item.size}{item.customText ? ` · “${item.customText}”` : ''}</p>
                    <div className="cart-item__bottom">
                      <div className="qty-control qty-control--small"><button onClick={() => updateQty(item.key, item.qty - 1)}><Minus size={13} /></button><span>{item.qty}</span><button onClick={() => updateQty(item.key, item.qty + 1)}><Plus size={13} /></button></div>
                      <strong>{money(item.lineTotal)}</strong>
                    </div>
                    {item.unitPrice < item.product.price && <small className="bulk-saving">Bulk price applied · {money(item.unitPrice)}/{item.product.unit}</small>}
                  </div>
                </article>
              ))}
            </div>
            <div className="cart-footer">
              <div className="cart-note"><GiftIcon size={18} /><span>উপহার? Checkout-এ একটি free note যোগ করতে পারবেন।</span></div>
              <div className="cart-totals"><span>Subtotal</span><strong>{money(subtotal)}</strong><small>Delivery charge checkout-এ হিসাব হবে</small></div>
              <button className="button button--honey button--wide" onClick={() => { setCartOpen(false); navigate('/checkout'); }}>Checkout-এ যাই <ArrowRight size={18} /></button>
              <button className="continue-shopping" onClick={() => setCartOpen(false)}>আরও একটু দেখি</button>
            </div>
          </>
        ) : (
          <div className="empty-cart">
            <div className="empty-cart__icon"><ShoppingBag size={34} /><span className="tiny-bee">✦</span></div>
            <h3>ব্যাগটা এখনো হালকা</h3>
            <p>পছন্দের কিছু খুঁজে নিন—আমরা যত্ন করে ব্যাগে তুলে রাখব।</p>
            <button className="button button--dark" onClick={() => { setCartOpen(false); navigate('/shop'); }}>দোকান ঘুরি <ArrowRight size={17} /></button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.kind}`} key={toast.key}>
      {toast.kind === 'love' ? <Heart size={17} fill="currentColor" /> : <CheckCircle2 size={18} />}
      <span>{toast.message}</span>
    </div>
  );
}

function ProductCard({ product, index = 0 }) {
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const liked = wishlist.includes(product.id);
  return (
    <article className="product-card" style={{ '--card-delay': `${index * 45}ms` }}>
      <div className="product-card__media">
        <Link to={`/product/${product.slug}`}>
          <img src={product.image} alt={product.title} loading="lazy" style={{ objectPosition: product.imagePosition || 'center' }} />
          <img className="product-card__alt" src={product.altImage} alt="" loading="lazy" style={{ objectPosition: product.imagePosition || 'center' }} />
        </Link>
        {product.badge && <span className={`product-badge product-badge--${product.badgeTone}`}>{product.badge}</span>}
        <button className={`wish-button ${liked ? 'is-liked' : ''}`} onClick={() => toggleWishlist(product.id)} aria-label="Wishlist"><Heart size={19} fill={liked ? 'currentColor' : 'none'} /></button>
        <button className="quick-add" onClick={() => addToCart(product, { qty: 1 })}><ShoppingBag size={17} /> ব্যাগে রাখুন</button>
      </div>
      <div className="product-card__content">
        <div className="product-rating"><Star size={13} fill="currentColor" /><span>{product.rating}</span><small>({product.reviews})</small>{product.customizable && <span className="custom-dot"><PencilLine size={12} /> custom করা যায়</span>}</div>
        <Link to={`/product/${product.slug}`} className="product-title">{product.title}</Link>
        <p>{product.short}</p>
        <div className="product-price"><strong>{money(product.price)}</strong>{product.oldPrice && <del>{money(product.oldPrice)}</del>}</div>
      </div>
    </article>
  );
}

function SectionHeading({ eyebrow, title, description, action, align = 'left' }) {
  return (
    <div className={`section-heading section-heading--${align}`}>
      <div>
        {eyebrow && <span className="eyebrow"><span />{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function HomePage() {
  return (
    <main>
      <Hero />
      <PromiseStrip />
      <CategoryMosaic />
      <FeaturedProducts />
      <CustomStudio compact />
      <StorySection />
      <ProcessSection />
      <Testimonials />
      <FaqSection />
      <Newsletter />
    </main>
  );
}

function Hero() {
  const navigate = useNavigate();
  return (
    <section className="hero-section">
      <div className="shell">
        <div className="hero-card">
          <div className="hero-copy">
            <span className="hero-kicker"><span className="bee-dot">✦</span> যত্ন করে বানানো, আপনার জন্য</span>
            <h1>যা ভাবেন,<br /><em>সেটাই বানাই।</em></h1>
            <p>কাস্টম পোশাক, প্রাণবন্ত প্রিন্ট আর মনের মতো উপহার—আপনার গল্পটা আমরা হাতে ধরে সত্যি করি।</p>
            <div className="hero-actions">
              <button className="button button--honey" onClick={() => navigate('/shop')}>দোকান ঘুরি <ArrowRight size={18} /></button>
              <button className="button button--ghost-light" onClick={() => navigate('/customize')}><Sparkles size={17} /> নিজের মতো বানাই</button>
            </div>
            <div className="hero-social-proof">
              <div className="avatar-stack"><span>NR</span><span>SA</span><span>RH</span><span>+2k</span></div>
              <div><div className="mini-stars">★★★★★</div><small>২,০০০+ আনন্দের অর্ডার</small></div>
            </div>
            <svg className="bee-trail" viewBox="0 0 200 65" aria-hidden="true"><path d="M1 52c36 2 30-46 71-36s18 49 67 34c24-7 22-36 57-31" /><circle cx="196" cy="19" r="3" /></svg>
          </div>
          <div className="hero-visual">
            <img src="/images/beebazar-hero.jpg" alt="BeeBazar-এর সৃজনশীল স্টুডিওতে উপহার ও কাস্টম পোশাক বানানো হচ্ছে" />
            <div className="hero-float hero-float--top"><span className="float-icon"><BadgeCheck size={20} /></span><div><strong>Design preview</strong><small>বানানোর আগেই দেখে নিন</small></div></div>
            <div className="hero-float hero-float--bottom"><span className="float-icon float-icon--rose">♥</span><div><strong>মানুষের হাতে</strong><small>প্যাক করা, একটি করে</small></div></div>
            <div className="hero-sticker"><small>আজকের</small><strong>mood</strong><span>happy!</span></div>
          </div>
        </div>
      </div>
      <div className="hero-marquee" aria-hidden="true"><div><span>✦ CUSTOM MADE</span><span>নিজের মতো রঙ</span><span>✦ SMALL DETAILS, BIG SMILES</span><span>সারা বাংলাদেশে</span><span>✦ MADE WITH CARE</span><span>নিজের মতো রঙ</span><span>✦ CUSTOM MADE</span><span>আপনার গল্প</span></div></div>
    </section>
  );
}

function PromiseStrip() {
  const items = [
    { icon: PencilLine, title: 'Design আগে দেখবেন', text: 'আপনার “হ্যাঁ” ছাড়া print নয়' },
    { icon: Headphones, title: 'মানুষের সঙ্গে কথা', text: 'Bot নয়, সত্যিকারের team' },
    { icon: Truck, title: 'দেশজুড়ে delivery', text: 'Tracking থাকবে প্রতিটি ধাপে' },
    { icon: ShieldCheck, title: 'ভুল হলে আমরা আছি', text: 'সহজ replacement support' },
  ];
  return (
    <section className="promise-section">
      <div className="shell promise-grid">
        {items.map((item, i) => <Reveal className="promise-item" delay={i * 70} key={item.title}><span><item.icon size={21} /></span><div><strong>{item.title}</strong><small>{item.text}</small></div></Reveal>)}
      </div>
    </section>
  );
}

function CategoryMosaic() {
  return (
    <section className="section category-section">
      <div className="shell">
        <Reveal><SectionHeading eyebrow="পছন্দের তাক" title={<>আজ কী <em>বানাতে</em> চান?</>} description="একটা ছোট উপহার থেকে একশো জনের team jersey—শুরুটা হোক আপনার প্রয়োজন দিয়ে।" action={<Link className="text-link" to="/shop">সব বিভাগ <ArrowRight size={17} /></Link>} /></Reveal>
        <div className="category-mosaic">
          {categories.map((category, index) => (
            <Reveal key={category.id} className={`category-tile category-tile--${index + 1}`} delay={index * 65}>
              <Link to={`/shop?category=${category.id}`}>
                <img src={category.image} alt="" loading="lazy" />
                <div className="category-shade" />
                <div className="category-tile__icon">
                  {category.icon === 'Shirt' && <Shirt />}{category.icon === 'Printer' && <Printer />}{category.icon === 'Gift' && <GiftIcon />}{category.icon === 'Sparkles' && <Sparkles />}{category.icon === 'PartyPopper' && <PartyPopper />}
                </div>
                <div className="category-tile__copy"><small>{category.english}</small><h3>{category.name}</h3><p>{category.blurb}</p></div>
                <span className="round-arrow"><ArrowRight size={19} /></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedProducts() {
  const [active, setActive] = useState('all');
  const shown = active === 'all' ? products.slice(0, 8) : products.filter((p) => p.category === active).slice(0, 8);
  return (
    <section className="section products-section">
      <div className="shell">
        <Reveal><SectionHeading eyebrow="THE HAPPY SHELF" title={<>এখন সবার <em>পছন্দ</em></>} description="ছোট ছোট আনন্দ—যেগুলো বারবার মানুষের ব্যাগে যাচ্ছে।" action={<Link className="text-link" to="/shop">সব পণ্য <ArrowRight size={17} /></Link>} /></Reveal>
        <div className="filter-pills">
          <button className={active === 'all' ? 'active' : ''} onClick={() => setActive('all')}>সবকিছু</button>
          {categories.slice(0, 4).map((category) => <button key={category.id} className={active === category.id ? 'active' : ''} onClick={() => setActive(category.id)}>{category.name}</button>)}
        </div>
        <div className="product-grid">
          {shown.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
        </div>
      </div>
    </section>
  );
}

function ProductMockup({ type, color, text }) {
  const ink = ['#f4efe2', '#f7f1e5', '#ffffff'].includes(color) ? '#173d31' : '#fff8e8';
  if (type === 'mug') {
    return <svg className="mockup-svg" viewBox="0 0 380 330"><ellipse cx="190" cy="288" rx="104" ry="18" fill="rgba(10,30,25,.14)" /><path d="M96 76h177v155c0 47-34 67-87 67s-90-20-90-67z" fill={color} /><path d="M270 113c70-11 72 100 6 105" fill="none" stroke={color} strokeWidth="28" strokeLinecap="round" /><path d="M270 128c43-5 41 68 3 72" fill="none" stroke="#f3e9d2" strokeWidth="10" /><ellipse cx="184" cy="77" rx="89" ry="18" fill="#f7edda" /><ellipse cx="184" cy="78" rx="74" ry="11" fill="#38281c" /><text x="183" y="179" textAnchor="middle" fill={ink} fontSize="25" fontWeight="700">{text || 'আপনার গল্প'}</text><path d="M148 196c24 13 50 13 74 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" /></svg>;
  }
  if (type === 'card') {
    return <svg className="mockup-svg" viewBox="0 0 380 330"><ellipse cx="190" cy="272" rx="135" ry="18" fill="rgba(10,30,25,.13)" /><g transform="rotate(-7 190 170)"><rect x="50" y="82" width="280" height="176" rx="14" fill={color} /><circle cx="190" cy="137" r="28" fill={ink} opacity=".15" /><path d="M177 137h26M190 124v26" stroke={ink} strokeWidth="4" strokeLinecap="round" /><text x="190" y="196" textAnchor="middle" fill={ink} fontSize="27" fontWeight="800">{text || 'আপনার নাম'}</text><text x="190" y="221" textAnchor="middle" fill={ink} fontSize="12" opacity=".8">YOUR STORY, BEAUTIFULLY PRINTED</text></g></svg>;
  }
  if (type === 'box') {
    return <svg className="mockup-svg" viewBox="0 0 380 330"><ellipse cx="190" cy="282" rx="136" ry="20" fill="rgba(10,30,25,.13)" /><path d="M65 128l126-56 126 56-126 56z" fill={color} /><path d="M65 128l126 56v106L65 230z" fill={color} opacity=".82" /><path d="M317 128l-126 56v106l126-60z" fill={color} opacity=".65" /><path d="M190 76v207M113 107l155 49" stroke={ink} strokeWidth="8" opacity=".75" /><path d="M176 80c-25-42-66-14-30 14 11 8 25 5 44-9 19 14 33 17 44 9 36-28-5-56-30-14" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round" /><text x="190" y="217" textAnchor="middle" fill={ink} fontSize="21" fontWeight="800" transform="skewY(23)">{text || 'শুধু তোমার জন্য'}</text></svg>;
  }
  return <svg className="mockup-svg" viewBox="0 0 380 330"><ellipse cx="190" cy="297" rx="118" ry="16" fill="rgba(10,30,25,.13)" /><path d="M131 78l-64 45 34 58 32-18v129h114V163l32 18 34-58-64-45-28 27h-62z" fill={color} /><path d="M159 78c5 30 57 30 62 0" fill="none" stroke={ink} strokeWidth="5" opacity=".5" /><text x="190" y="184" textAnchor="middle" fill={ink} fontSize="25" fontWeight="800">{text || 'নিজের মতো'}</text><path d="M158 201c21 10 43 10 64 0" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" /><circle cx="148" cy="151" r="4" fill={ink} opacity=".65" /><circle cx="232" cy="151" r="4" fill={ink} opacity=".65" /></svg>;
}

function CustomStudio({ compact = false }) {
  const [type, setType] = useState('hoodie');
  const [color, setColor] = useState('#efb83f');
  const [text, setText] = useState('নিজের মতো');
  const navigate = useNavigate();
  const types = [
    { id: 'hoodie', label: 'হুডি', icon: Shirt },
    { id: 'mug', label: 'মগ', icon: Camera },
    { id: 'card', label: 'কার্ড', icon: Layers3 },
    { id: 'box', label: 'গিফট বক্স', icon: GiftIcon },
  ];
  const colors = ['#efb83f', '#173d31', '#c96966', '#315f8b', '#f4efe2'];
  return (
    <section className={`section custom-studio ${compact ? 'custom-studio--compact' : ''}`}>
      <div className="shell">
        <div className="studio-wrap">
          <div className="studio-copy">
            <span className="eyebrow eyebrow--light"><span /> LIVE PLAYGROUND</span>
            <h2>একটু খেলেই দেখুন—<br /><em>আপনার মতো</em> লাগে কি না</h2>
            <p>Product বাছুন, একটি রঙ নিন, তারপর নিজের কথাটা লিখুন। এই preview শুধু শুরু—final design আমরা একসঙ্গে গুছিয়ে দেব।</p>
            <div className="studio-steps"><span className="is-active">১ <small>Product</small></span><i /><span className="is-active">২ <small>রঙ</small></span><i /><span className="is-active">৩ <small>আপনার কথা</small></span></div>
            <div className="studio-controls">
              <label>কী বানাবেন?</label>
              <div className="type-buttons">{types.map((item) => <button key={item.id} className={type === item.id ? 'active' : ''} onClick={() => setType(item.id)}><item.icon size={18} /> {item.label}</button>)}</div>
              <div className="studio-control-row"><div><label>মনের রঙ</label><div className="color-swatches">{colors.map((item) => <button key={item} className={color === item ? 'active' : ''} style={{ '--swatch': item }} onClick={() => setColor(item)} aria-label={item}>{color === item && <Check size={14} />}</button>)}</div></div><div className="studio-text-input"><label>যা লিখতে চান</label><input maxLength={18} value={text} onChange={(e) => setText(e.target.value)} placeholder="আপনার কথা" /></div></div>
              <button className="button button--honey" onClick={() => navigate('/customize')}>পুরোটা বানাই <ArrowRight size={18} /></button>
            </div>
          </div>
          <div className="studio-preview">
            <div className="preview-top"><span><span className="live-dot" /> LIVE PREVIEW</span><button><RotateCcw size={15} /> আবার</button></div>
            <div className="mockup-stage"><div className="honeycomb honeycomb--one" /><div className="honeycomb honeycomb--two" /><ProductMockup type={type} color={color} text={text} /><span className="preview-note"><PencilLine size={14} /> Final artwork বানানোর আগে আপনি approve করবেন</span></div>
            <div className="preview-bottom"><div><small>Starting from</small><strong>{type === 'hoodie' ? '৳১,৪৯০' : type === 'mug' ? '৳৪৫০' : type === 'card' ? '৳৬৫০' : '৳১,২৯০'}</strong></div><span>৩–৫ দিনে তৈরি <Clock3 size={15} /></span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StorySection() {
  return (
    <section className="section story-section" id="story">
      <div className="shell story-grid">
        <Reveal className="story-visual">
          <img src="/images/beebazar-hero.jpg" alt="BeeBazar studio team" loading="lazy" />
          <div className="story-note"><Quote size={19} /><p>একটা order আমাদের কাছে শুধু invoice নয়—কারও team, কারও surprise, কারও নতুন business-এর শুরু।</p><strong>— BeeBazar studio</strong></div>
          <span className="story-number"><strong>2k+</strong><small>ছোট-বড় গল্প বানানো</small></span>
        </Reveal>
        <Reveal className="story-copy" delay={120}>
          <span className="eyebrow"><span /> A VERY HUMAN BAZAR</span>
          <h2>স্ক্রিনের ওপাশে<br /><em>আমরা মানুষ আছি।</em></h2>
          <p className="story-lead">BeeBazar-এর শুরু “জিনিস” দিয়ে নয়—মানুষের ভাবনা দিয়ে। আপনি হয়তো ঠিক করে বলতে পারবেন না কী চান। সমস্যা নেই, গল্পটা বলুন। বাকিটা আমরা প্রশ্ন করে বুঝে নেব।</p>
          <div className="story-values">
            <div><span>01</span><p><strong>শুনি, তারপর বানাই</strong><small>Template চাপিয়ে না দিয়ে প্রয়োজনটা বুঝি।</small></p></div>
            <div><span>02</span><p><strong>ছোট detail-এ যত্ন</strong><small>রঙ, fold, note—যেটুকু আনন্দ বাড়ায়।</small></p></div>
            <div><span>03</span><p><strong>ভুল হলে লুকাই না</strong><small>মানুষের মতো কথা বলে সমাধান করি।</small></p></div>
          </div>
          <Link className="button button--outline" to="/customize">আপনার ভাবনা বলুন <MessageCircle size={17} /></Link>
        </Reveal>
      </div>
    </section>
  );
}

function ProcessSection() {
  const steps = [
    { no: '১', icon: Sparkles, title: 'পছন্দ বা ভাবনা', text: 'তাক থেকে বেছে নিন, অথবা একদম নতুন কিছু বলুন।' },
    { no: '২', icon: PencilLine, title: 'আমরা preview করি', text: 'Custom order হলে production-এর আগেই mockup পাবেন।' },
    { no: '৩', icon: CheckCircle2, title: 'আপনি “হ্যাঁ” বলেন', text: 'রঙ, লেখা, size—সব ঠিক হলেই বানানো শুরু।' },
    { no: '৪', icon: Package, title: 'যত্ন করে পৌঁছে দিই', text: 'Tracking-সহ সারা বাংলাদেশে আপনার দরজায়।' },
  ];
  return (
    <section className="section process-section">
      <div className="shell">
        <Reveal><SectionHeading eyebrow="সহজ রাখি" title={<>ভাবনা থেকে হাতে—<em>চার ধাপে</em></>} align="center" description="Custom মানেই জটিল নয়। কোথায় কী হচ্ছে, সবসময় জানবেন।" /></Reveal>
        <div className="process-grid">
          {steps.map((step, index) => <Reveal className="process-card" delay={index * 80} key={step.title}><span className="process-number">{step.no}</span><div className="process-icon"><step.icon size={25} /></div><h3>{step.title}</h3><p>{step.text}</p>{index < steps.length - 1 && <svg className="process-arrow" viewBox="0 0 100 30"><path d="M2 15c25-12 55-12 85 0" /><path d="M79 8l9 7-10 7" /></svg>}</Reveal>)}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="section testimonials-section">
      <div className="shell">
        <Reveal><SectionHeading eyebrow="KIND WORDS" title={<>পার্সেল খুলে যে <em>হাসি</em></>} description="বিজ্ঞাপনের ভাষা নয়—যারা সত্যি আমাদের দিয়ে বানিয়েছেন, তাদের কথা।" /></Reveal>
        <div className="testimonial-grid">
          {testimonials.map((item, index) => <Reveal className={`testimonial-card testimonial-card--${index + 1}`} delay={index * 90} key={item.name}><Quote className="quote-mark" size={32} /><div className="mini-stars">★★★★★</div><blockquote>{item.quote}</blockquote><div className="testimonial-person"><span style={{ '--avatar': item.color }}>{item.initials}</span><div><strong>{item.name}</strong><small>{item.meta}</small></div><BadgeCheck size={18} /></div></Reveal>)}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section faq-section">
      <div className="shell faq-grid">
        <Reveal className="faq-intro"><span className="eyebrow"><span /> নির্ভয়ে জিজ্ঞেস করুন</span><h2>মনে প্রশ্ন?<br /><em>আমরা আছি।</em></h2><p>উত্তরটা এখানে না থাকলে সরাসরি একজন মানুষের সঙ্গে কথা হবে—এটাই promise।</p><a className="button button--outline" href="tel:+8801700000000"><Phone size={17} /> কথা বলুন</a><div className="faq-hours"><span><span className="live-dot" /> এখন online</span><small>শনিবার–বৃহস্পতিবার · সকাল ১০টা–রাত ৯টা</small></div></Reveal>
        <div className="faq-list">{faqs.map((item, index) => <Reveal className={`faq-item ${open === index ? 'is-open' : ''}`} delay={index * 55} key={item.q}><button onClick={() => setOpen(open === index ? -1 : index)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.q}</strong><Plus size={20} /></button><div className="faq-answer"><p>{item.a}</p></div></Reveal>)}</div>
      </div>
    </section>
  );
}

function Newsletter() {
  const { notify } = useStore();
  const submit = (event) => { event.preventDefault(); notify('BeeLetter-এ আপনাকে পাওয়া গেল!'); event.currentTarget.reset(); };
  return (
    <section className="newsletter-section">
      <div className="shell">
        <div className="newsletter-card">
          <div className="newsletter-decor newsletter-decor--one">✦</div><div className="newsletter-decor newsletter-decor--two">⌁</div>
          <div><span className="eyebrow eyebrow--light"><span /> NO SPAM, ONLY HONEY</span><h2>মাঝে মাঝে একটু<br /><em>মধুর খবর?</em></h2><p>নতুন design, ছোট discount আর বানানোর পেছনের গল্প—মাসে বড়জোর দুইবার।</p></div>
          <form onSubmit={submit}><Mail size={19} /><input type="email" required placeholder="আপনার email ঠিকানা" /><button className="button button--honey">BeeLetter-এ আসি <Send size={17} /></button><small>যখন ইচ্ছে বিদায় নিতে পারবেন। কোনো অভিমান নেই।</small></form>
        </div>
      </div>
    </section>
  );
}

function ShopPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const categoryParam = params.get('category') || 'all';
  const likedOnly = params.get('liked') === '1';
  const { wishlist } = useStore();
  const [sort, setSort] = useState(params.get('sort') === 'deal' ? 'deal' : 'featured');
  const [customOnly, setCustomOnly] = useState(false);
  const [priceMax, setPriceMax] = useState(3000);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visible = useMemo(() => {
    let result = [...products];
    if (categoryParam !== 'all') result = result.filter((p) => p.category === categoryParam);
    if (query) result = result.filter((p) => `${p.title} ${p.short} ${p.description}`.toLowerCase().includes(query.toLowerCase()));
    if (likedOnly) result = result.filter((p) => wishlist.includes(p.id));
    if (customOnly) result = result.filter((p) => p.customizable);
    result = result.filter((p) => p.price <= priceMax);
    if (sort === 'low') result.sort((a, b) => a.price - b.price);
    if (sort === 'high') result.sort((a, b) => b.price - a.price);
    if (sort === 'rating') result.sort((a, b) => b.rating - a.rating);
    if (sort === 'deal') result.sort((a, b) => ((b.oldPrice || b.price) - b.price) - ((a.oldPrice || a.price) - a.price));
    return result;
  }, [categoryParam, query, likedOnly, wishlist, customOnly, priceMax, sort]);

  const changeCategory = (id) => {
    const next = new URLSearchParams(params);
    if (id === 'all') next.delete('category'); else next.set('category', id);
    next.delete('liked');
    setParams(next);
  };

  return (
    <main className="shop-page">
      <section className="shop-hero">
        <div className="shell shop-hero__inner"><div><span className="eyebrow"><span /> THE HAPPY SHELF</span><h1>{likedOnly ? 'আপনার পছন্দের তালিকা' : query ? `“${query}” খুঁজছেন` : categoryParam !== 'all' ? categories.find((c) => c.id === categoryParam)?.name : 'সব আনন্দ, এক তাকেই'}</h1><p>{likedOnly ? 'যেগুলো দেখে আপনার মন একটু থেমেছিল—সব এখানে।' : 'দরকারি, সুন্দর আর নিজের মতো করা যায়—এমন জিনিস বেছে রাখলাম।'}</p></div><div className="shop-hero__doodle"><span>bee</span><strong>happy</strong><small>shop slowly ☺</small></div></div>
      </section>
      <div className="shell shop-layout">
        <div className="shop-toolbar">
          <div className="category-tabs"><button className={categoryParam === 'all' && !likedOnly ? 'active' : ''} onClick={() => changeCategory('all')}>সব</button>{categories.map((category) => <button key={category.id} className={categoryParam === category.id ? 'active' : ''} onClick={() => changeCategory(category.id)}>{category.name}</button>)}</div>
          <div className="shop-toolbar__actions"><button className="mobile-filter-button" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={17} /> Filter</button><span>{visible.length.toLocaleString('bn-BD')}টি পাওয়া গেছে</span><label><ArrowUpDown size={16} /><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Featured</option><option value="deal">Best deal</option><option value="low">দাম: কম থেকে বেশি</option><option value="high">দাম: বেশি থেকে কম</option><option value="rating">Top rated</option></select></label></div>
        </div>
        <div className="shop-content">
          <aside className={`filter-sidebar ${filtersOpen ? 'is-open' : ''}`}>
            <div className="filter-sidebar__mobile-head"><strong>Filter করুন</strong><button className="icon-button" onClick={() => setFiltersOpen(false)}><X size={19} /></button></div>
            <div className="filter-group"><h3>বিভাগ</h3><label><input type="radio" checked={categoryParam === 'all'} onChange={() => changeCategory('all')} /><span>সব পণ্য</span><small>{products.length}</small></label>{categories.map((category) => <label key={category.id}><input type="radio" checked={categoryParam === category.id} onChange={() => changeCategory(category.id)} /><span>{category.name}</span><small>{products.filter((p) => p.category === category.id).length}</small></label>)}</div>
            <div className="filter-group"><h3>আপনার মতো</h3><label className="toggle-label"><input type="checkbox" checked={customOnly} onChange={(e) => setCustomOnly(e.target.checked)} /><span className="toggle-ui" /><span>Custom করা যায়</span></label></div>
            <div className="filter-group"><h3>সর্বোচ্চ দাম <strong>{money(priceMax)}</strong></h3><input className="price-range" type="range" min="300" max="3000" step="100" value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} /><div className="range-labels"><span>৳৩০০</span><span>৳৩,০০০</span></div></div>
            <div className="bulk-help"><Box size={23} /><strong>৫০+ পিস লাগবে?</strong><p>পরিমাণ বলুন, আমরা আলাদা price পাঠাব।</p><Link to="/customize">Bulk quote নিন <ArrowRight size={15} /></Link></div>
          </aside>
          <section className="shop-results">
            {visible.length ? <div className="product-grid product-grid--shop">{visible.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <div className="no-products"><div><Search size={34} /></div><h2>এই তাকটা এখন খালি</h2><p>Filter একটু বদলে দেখুন, অথবা আপনার ভাবনাটা আমাদের বলুন।</p><button className="button button--dark" onClick={() => { setParams({}); setCustomOnly(false); setPriceMax(3000); }}>সব পণ্য দেখি</button></div>}
          </section>
        </div>
      </div>
    </main>
  );
}

function ProductPage() {
  const { slug } = useParams();
  const product = products.find((p) => p.slug === slug);
  const navigate = useNavigate();
  const { addToCart, wishlist, toggleWishlist, getUnitPrice } = useStore();
  const [activeImage, setActiveImage] = useState(0);
  const [size, setSize] = useState(product?.sizes?.[0] || '');
  const [color, setColor] = useState(product?.colors?.[0] || '');
  const [qty, setQty] = useState(1);
  const [customText, setCustomText] = useState('');
  const [openInfo, setOpenInfo] = useState('details');
  if (!product) return <NotFound />;
  const unitPrice = getUnitPrice(product, qty);
  const images = [product.image, product.altImage, '/images/beebazar-hero.jpg'];
  const category = categories.find((c) => c.id === product.category);
  const liked = wishlist.includes(product.id);
  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const buyNow = () => { addToCart(product, { qty, size, color, customText, openCart: false }); navigate('/checkout'); };

  return (
    <main className="product-page">
      <div className="shell breadcrumbs"><Link to="/">হোম</Link><ChevronRight size={14} /><Link to={`/shop?category=${product.category}`}>{category?.name}</Link><ChevronRight size={14} /><span>{product.title}</span></div>
      <section className="shell product-detail">
        <div className="product-gallery">
          <div className="gallery-thumbs">{images.map((image, index) => <button key={`${image}-${index}`} className={activeImage === index ? 'active' : ''} onClick={() => setActiveImage(index)}><img src={image} alt="" style={{ objectPosition: product.imagePosition }} /></button>)}</div>
          <div className="gallery-main"><img src={images[activeImage]} alt={product.title} style={{ objectPosition: product.imagePosition }} /><span className={`product-badge product-badge--${product.badgeTone}`}>{product.badge}</span><button className={`gallery-wish ${liked ? 'is-liked' : ''}`} onClick={() => toggleWishlist(product.id)}><Heart fill={liked ? 'currentColor' : 'none'} /></button><span className="gallery-zoom"><Eye size={16} /> Hover to look closer</span></div>
        </div>
        <div className="product-info">
          <span className="product-category">{category?.english} · {category?.name}</span>
          <h1>{product.title}</h1>
          <p className="product-subtitle">{product.short}</p>
          <div className="detail-rating"><span className="mini-stars">★★★★★</span><strong>{product.rating}</strong><a href="#reviews">{product.reviews}টি review</a><span className="stock-status"><span /> হাতে আছে</span></div>
          <div className="detail-price"><strong>{money(unitPrice)}</strong>{product.oldPrice && unitPrice === product.price && <del>{money(product.oldPrice)}</del>}<span>VAT included</span></div>
          {unitPrice < product.price && <div className="bulk-applied"><Sparkles size={16} /> Bulk price applied—প্রতি {product.unit}তে {money(product.price - unitPrice)} সাশ্রয়</div>}
          <p className="detail-description">{product.description}</p>
          <div className="option-block"><div className="option-head"><strong>রঙ বাছুন</strong><span>{color}</span></div><div className="detail-swatches">{product.colors.map((item) => <button key={item} className={color === item ? 'active' : ''} style={{ '--swatch': item }} onClick={() => setColor(item)}>{color === item && <Check size={14} />}</button>)}</div></div>
          <div className="option-block"><div className="option-head"><strong>ধরন / Size</strong><button><Ruler size={15} /> Size guide</button></div><div className="size-options">{product.sizes.map((item) => <button key={item} className={size === item ? 'active' : ''} onClick={() => setSize(item)}>{item}</button>)}</div></div>
          {product.customizable && <div className="personalize-box"><div><span><PencilLine size={19} /></span><div><strong>একটু নিজের মতো করবেন?</strong><small>নাম বা ছোট্ট লাইন লিখুন—optional</small></div></div><input value={customText} maxLength={24} onChange={(e) => setCustomText(e.target.value)} placeholder="যেমন: Team Aurora / শুভ জন্মদিন" /><button className="upload-button"><Upload size={16} /> Logo বা design upload <small>PNG, JPG, PDF</small></button></div>}
          <div className="bulk-tier-box"><div className="bulk-tier-head"><span><Box size={18} /> বেশি নিলে, কম দাম</span><small>Quantity tap করে দেখুন</small></div><div className="tier-row"><button className={qty === 1 ? 'active' : ''} onClick={() => setQty(1)}><strong>১–{product.wholesale[0].min - 1}</strong><span>{money(product.price)}</span></button>{product.wholesale.map((tier, index) => <button key={tier.min} className={qty === tier.min ? 'active' : ''} onClick={() => setQty(tier.min)}><strong>{tier.min}{index === product.wholesale.length - 1 ? '+' : `–${product.wholesale[index + 1].min - 1}`}</strong><span>{money(tier.price)}</span></button>)}</div></div>
          <div className="buy-row"><div className="qty-control"><button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={16} /></button><span>{qty}</span><button onClick={() => setQty(qty + 1)}><Plus size={16} /></button></div><button className="button button--dark add-main" onClick={() => addToCart(product, { qty, size, color, customText })}><ShoppingBag size={18} /> ব্যাগে রাখুন · {money(unitPrice * qty)}</button><button className="button button--honey buy-now" onClick={buyNow}>এখনই কিনি</button></div>
          <div className="delivery-note"><Truck size={19} /><div><strong>আনুমানিক delivery: {product.delivery}</strong><small>ঢাকার বাইরে ১–২ দিন বেশি লাগতে পারে</small></div><ChevronRight size={17} /></div>
          <div className="detail-accordions">
            <button className={openInfo === 'details' ? 'active' : ''} onClick={() => setOpenInfo(openInfo === 'details' ? '' : 'details')}><strong>কী কী থাকছে</strong><Plus size={18} /></button>{openInfo === 'details' && <ul>{product.details.map((item) => <li key={item}><Check size={15} /> {item}</li>)}</ul>}
            <button className={openInfo === 'care' ? 'active' : ''} onClick={() => setOpenInfo(openInfo === 'care' ? '' : 'care')}><strong>যত্ন ও return</strong><Plus size={18} /></button>{openInfo === 'care' && <p>Custom item ধোয়া বা ব্যবহারের নির্দেশনা parcel-এ থাকবে। Manufacturing defect বা ভুল print হলে delivery-এর ৪৮ ঘণ্টার মধ্যে ছবি পাঠান।</p>}
          </div>
        </div>
      </section>
      <section className="detail-promises"><div className="shell"><span><ShieldCheck />Secure checkout</span><span><PencilLine />Design approval</span><span><Truck />Tracked delivery</span><span><Headphones />Human support</span></div></section>
      <section className="section related-section"><div className="shell"><SectionHeading eyebrow="আরও একটু দেখি" title={<>এর সঙ্গে যেগুলো <em>ভালো যায়</em></>} action={<Link className="text-link" to={`/shop?category=${product.category}`}>সব দেখি <ArrowRight size={16} /></Link>} /><div className="product-grid">{related.map((item, index) => <ProductCard key={item.id} product={item} index={index} />)}</div></div></section>
    </main>
  );
}

function CustomizePage() {
  return (
    <main className="customize-page">
      <section className="custom-page-hero"><div className="shell"><span className="eyebrow eyebrow--light"><span /> BEEBESPOKE</span><h1>আপনার মাথার ভেতরের<br /><em>ছবিটা সত্যি করি।</em></h1><p>একটি হুডি, একশোটি gift box বা পুরো event-এর print—brief ছোট হোক বা অগোছালো, সেখান থেকেই শুরু।</p><div className="custom-page-chips"><span><Check /> Free first mockup</span><span><Check /> মানুষ আপনার brief পড়বে</span><span><Check /> Production-এর আগে approval</span></div></div></section>
      <CustomStudio />
      <CustomBriefForm />
    </main>
  );
}

function CustomBriefForm() {
  const { notify } = useStore();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState('পোশাক');
  const [form, setForm] = useState({ qty: '1–10', date: '', idea: '', name: '', phone: '' });
  const submit = (event) => { event.preventDefault(); notify('আপনার brief আমাদের কাছে এসেছে—শিগগির কথা হবে!'); setStep(4); };
  return (
    <section className="section brief-section">
      <div className="shell brief-grid">
        <div className="brief-intro"><span className="eyebrow"><span /> START A PROJECT</span><h2>ভাবনাটা বলুন,<br /><em>বাকিটা একসঙ্গে।</em></h2><p>Price সঙ্গে সঙ্গে না জানলেও চিন্তা নেই। আপনার প্রয়োজন বুঝে একজন মানুষ WhatsApp বা ফোনে কথা বলবে।</p><div className="brief-contact"><div><MessageCircle /><span><strong>WhatsApp-এ স্বচ্ছন্দ?</strong><small>০১৭০০ ০০০ ০০০</small></span></div><div><Clock3 /><span><strong>সাড়া দেওয়ার সময়</strong><small>সাধারণত ৩০ মিনিটের মধ্যে</small></span></div></div></div>
        <form className="brief-form" onSubmit={submit}>
          {step < 4 && <div className="brief-progress"><span style={{ width: `${step * 33.33}%` }} /><small>ধাপ {step} / ৩</small></div>}
          {step === 1 && <div className="brief-step"><span className="form-kicker">প্রথমে বলুন</span><h3>কী বানানোর কথা ভাবছেন?</h3><div className="brief-types">{['পোশাক', 'প্রিন্ট', 'উপহার', 'ইভেন্ট কিট', 'অন্য কিছু'].map((item) => <button type="button" className={selected === item ? 'active' : ''} key={item} onClick={() => setSelected(item)}>{item === 'পোশাক' && <Shirt />}{item === 'প্রিন্ট' && <Printer />}{item === 'উপহার' && <GiftIcon />}{item === 'ইভেন্ট কিট' && <PartyPopper />}{item === 'অন্য কিছু' && <Sparkles />}<span>{item}</span>{selected === item && <CheckCircle2 />}</button>)}</div><button type="button" className="button button--dark brief-next" onClick={() => setStep(2)}>পরের ধাপ <ArrowRight /></button></div>}
          {step === 2 && <div className="brief-step"><button type="button" className="back-step" onClick={() => setStep(1)}><ArrowLeft /> পেছনে</button><span className="form-kicker">একটু হিসাব</span><h3>পরিমাণ আর সময় কেমন?</h3><label>আনুমানিক পরিমাণ<select value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })}><option>1–10</option><option>11–30</option><option>31–100</option><option>100+</option></select></label><label>কবে নাগাদ প্রয়োজন? <small>(optional)</small><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label>মাথায় যা আছে, নিজের ভাষায় লিখুন<textarea rows="4" value={form.idea} onChange={(e) => setForm({ ...form, idea: e.target.value })} placeholder="যেমন: আমাদের department-এর ৫০টি কালো hoodie চাই, সামনে ছোট logo..." /></label><button type="button" className="upload-brief"><Upload /> Reference image / logo দিন <small>PNG, JPG বা PDF · সর্বোচ্চ 10MB</small></button><button type="button" className="button button--dark brief-next" onClick={() => setStep(3)}>শেষ ধাপ <ArrowRight /></button></div>}
          {step === 3 && <div className="brief-step"><button type="button" className="back-step" onClick={() => setStep(2)}><ArrowLeft /> পেছনে</button><span className="form-kicker">কোথায় কথা হবে?</span><h3>আপনার সঙ্গে পরিচিত হই</h3><label>আপনার নাম<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="আপনার নাম" /></label><label>মোবাইল / WhatsApp<input required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="০১XXXXXXXXX" /></label><div className="brief-summary"><strong>আপনার brief</strong><span>{selected} · {form.qty}টি {form.date && `· ${form.date}`}</span><button type="button" onClick={() => setStep(1)}>বদলান</button></div><button className="button button--honey button--wide" type="submit">Brief পাঠাই <Send /></button><small className="privacy-note"><LockKeyhole /> আপনার তথ্য শুধু এই project নিয়ে কথা বলার জন্য ব্যবহার হবে।</small></div>}
          {step === 4 && <div className="brief-success"><div><CheckCircle2 /></div><span className="form-kicker">BRIEF RECEIVED</span><h3>ইয়েই, শুরু হয়ে গেল!</h3><p>ধন্যবাদ {form.name || 'বন্ধু'}। একজন BeeBazar মানুষ খুব শিগগির <strong>{form.phone || 'আপনার নম্বরে'}</strong> যোগাযোগ করবে।</p><button type="button" className="button button--outline" onClick={() => { setStep(1); setForm({ qty: '1–10', date: '', idea: '', name: '', phone: '' }); }}>আরেকটি brief</button></div>}
        </form>
      </div>
    </section>
  );
}

function CheckoutPage() {
  const { cartLines, subtotal, clearCart, notify } = useStore();
  const [delivery, setDelivery] = useState('inside');
  const [payment, setPayment] = useState('cod');
  const [giftNote, setGiftNote] = useState('');
  const [placed, setPlaced] = useState(false);
  const [orderNo] = useState(() => `BB-${Math.floor(100000 + Math.random() * 900000)}`);
  const shipping = subtotal >= 2000 && delivery === 'inside' ? 0 : delivery === 'inside' ? 80 : 130;
  const total = subtotal + shipping;
  const submit = (event) => {
    event.preventDefault();
    if (!cartLines.length) return;
    setPlaced(true);
    clearCart();
    notify('অর্ডারটি সফল হয়েছে!');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (placed) return (
    <main className="order-success-page"><div className="success-confetti">✦ <span>●</span> ✧ <i>♥</i></div><div className="success-card"><div className="success-icon"><Check /></div><span className="eyebrow"><span /> ORDER CONFIRMED</span><h1>ইয়েই! এখন বানানোর<br />পালা আমাদের।</h1><p>আপনার order <strong>#{orderNo}</strong> পেয়েছি। একটি confirmation message পাঠানো হয়েছে। Custom item থাকলে design preview নিয়ে আমরা কথা বলব।</p><div className="success-timeline"><span className="done"><i><Check /></i><strong>Order হয়েছে</strong><small>এইমাত্র</small></span><span><i><PencilLine /></i><strong>Design check</strong><small>প্রয়োজনে</small></span><span><i><Package /></i><strong>যত্ন করে তৈরি</strong><small>তারপর</small></span><span><i><Truck /></i><strong>আপনার পথে</strong><small>শেষ ধাপ</small></span></div><div className="success-actions"><Link className="button button--dark" to="/shop">আরও দেখি</Link><Link className="button button--outline" to="/">হোমে ফিরি</Link></div><small>কিছু জানতে চান? <a href="tel:+8801700000000">০১৭০০ ০০০ ০০০</a></small></div></main>
  );

  if (!cartLines.length) return <main className="checkout-empty"><div><ShoppingBag size={40} /><h1>Checkout-এর আগে ব্যাগে কিছু রাখি?</h1><p>আপনার ব্যাগ এখনো খালি। পছন্দের কিছু বেছে নিয়ে আবার আসুন।</p><Link className="button button--dark" to="/shop">দোকান ঘুরি <ArrowRight /></Link></div></main>;

  return (
    <main className="checkout-page">
      <div className="checkout-header"><div className="shell"><Logo /><div className="secure-checkout"><LockKeyhole size={17} /> নিরাপদ checkout</div></div></div>
      <div className="shell checkout-grid">
        <form className="checkout-form" onSubmit={submit}>
          <div className="checkout-title"><span className="eyebrow"><span /> ALMOST YOURS</span><h1>কোথায় পৌঁছে দেব?</h1><p>তারকা (*) দেওয়া তথ্যগুলো প্রয়োজন।</p></div>
          <section className="checkout-section"><div className="checkout-section__head"><span>১</span><div><h2>আপনার তথ্য</h2><p>Delivery নিয়ে কথা বলতে ব্যবহার হবে</p></div></div><div className="form-grid"><label>পুরো নাম *<input required placeholder="যেমন, সাদিয়া রহমান" /></label><label>মোবাইল নম্বর *<input required inputMode="tel" pattern="[0-9০-৯+ ]{10,}" placeholder="০১XXXXXXXXX" /></label><label className="full">Email <small>(optional)</small><input type="email" placeholder="name@example.com" /></label></div></section>
          <section className="checkout-section"><div className="checkout-section__head"><span>২</span><div><h2>Delivery ঠিকানা</h2><p>একটু detail দিলে rider সহজে খুঁজে পাবে</p></div></div><div className="form-grid"><label className="full">বাসা / Road / এলাকার ঠিকানা *<textarea required rows="3" placeholder="বাসা ১২, রোড ৪, ধানমন্ডি..." /></label><label>থানা / উপজেলা *<input required placeholder="ধানমন্ডি" /></label><label>জেলা *<select required defaultValue="ঢাকা"><option>ঢাকা</option><option>চট্টগ্রাম</option><option>রাজশাহী</option><option>সিলেট</option><option>খুলনা</option><option>বরিশাল</option><option>রংপুর</option><option>ময়মনসিংহ</option></select></label><label className="full">Rider-এর জন্য note <small>(optional)</small><input placeholder="যেমন: মসজিদের পাশের নীল গেট" /></label></div><div className="choice-cards delivery-choices"><label className={delivery === 'inside' ? 'active' : ''}><input type="radio" name="delivery" value="inside" checked={delivery === 'inside'} onChange={(e) => setDelivery(e.target.value)} /><span><Truck /></span><div><strong>ঢাকার ভেতরে</strong><small>১–২ দিন · {subtotal >= 2000 ? 'Free' : '৳৮০'}</small></div><CheckCircle2 /></label><label className={delivery === 'outside' ? 'active' : ''}><input type="radio" name="delivery" value="outside" checked={delivery === 'outside'} onChange={(e) => setDelivery(e.target.value)} /><span><Package /></span><div><strong>ঢাকার বাইরে</strong><small>২–৪ দিন · ৳১৩০</small></div><CheckCircle2 /></label></div></section>
          <section className="checkout-section"><div className="checkout-section__head"><span>৩</span><div><h2>Payment পদ্ধতি</h2><p>যেটা আপনার জন্য সহজ</p></div></div><div className="choice-cards payment-choices"><label className={payment === 'cod' ? 'active' : ''}><input type="radio" name="payment" value="cod" checked={payment === 'cod'} onChange={(e) => setPayment(e.target.value)} /><span><Banknote /></span><div><strong>Cash on delivery</strong><small>পার্সেল পেয়ে payment</small></div><CheckCircle2 /></label><label className={payment === 'bkash' ? 'active' : ''}><input type="radio" name="payment" value="bkash" checked={payment === 'bkash'} onChange={(e) => setPayment(e.target.value)} /><span className="bkash-mark">b</span><div><strong>bKash</strong><small>নিরাপদ gateway</small></div><CheckCircle2 /></label><label className={payment === 'card' ? 'active' : ''}><input type="radio" name="payment" value="card" checked={payment === 'card'} onChange={(e) => setPayment(e.target.value)} /><span><CreditCard /></span><div><strong>Card / Bank</strong><small>Visa, Mastercard, banking</small></div><CheckCircle2 /></label></div>{payment !== 'cod' && <div className="gateway-note"><LockKeyhole size={16} /> “অর্ডার নিশ্চিত করি” চাপার পর secure payment page খুলবে। এটি এখন একটি demo flow।</div>}</section>
          <section className="checkout-section gift-note-section"><div className="checkout-section__head"><span><GiftIcon /></span><div><h2>উপহার দিচ্ছেন?</h2><p>একটি ছোট note আমরা free-তে লিখে দেব</p></div></div><textarea rows="3" maxLength="140" value={giftNote} onChange={(e) => setGiftNote(e.target.value)} placeholder="প্রিয় ..., তোমার জন্য..." /><small>{giftNote.length}/১৪০</small></section>
          <button className="button button--honey button--wide place-order" type="submit"><LockKeyhole size={18} /> অর্ডার নিশ্চিত করি · {money(total)}</button><p className="checkout-consent">Order করার মাধ্যমে আপনি আমাদের <a href="#">শর্ত</a>, <a href="#">privacy</a> ও <a href="#">return policy</a>-তে সম্মতি দিচ্ছেন।</p>
        </form>
        <aside className="order-summary"><div className="order-summary__head"><h2>আপনার অর্ডার</h2><Link to="/shop">আরও যোগ করি</Link></div><div className="summary-items">{cartLines.map((item) => <div className="summary-item" key={item.key}><div><img src={item.product.image} alt="" style={{ objectPosition: item.product.imagePosition }} /><span>{item.qty}</span></div><p><strong>{item.product.title}</strong><small>{item.size}{item.customText ? ` · “${item.customText}”` : ''}</small></p><b>{money(item.lineTotal)}</b></div>)}</div><div className="coupon-box"><input placeholder="Coupon code" /><button type="button">Apply</button></div><div className="summary-totals"><p><span>Subtotal</span><strong>{money(subtotal)}</strong></p><p><span>Delivery</span><strong>{shipping ? money(shipping) : 'Free'}</strong></p><div><span>সর্বমোট <small>VAT included</small></span><strong>{money(total)}</strong></div></div><div className="summary-promise"><ShieldCheck /><p><strong>নিশ্চিন্তে order করুন</strong><small>Secure payment · সহজ support · যত্নের packaging</small></p></div></aside>
      </div>
    </main>
  );
}

function HelpBubble() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`help-widget ${open ? 'is-open' : ''}`}>
      {open && <div className="help-popover"><div className="help-popover__head"><span className="helper-avatar">B</span><div><strong>Bee team</strong><small><span className="live-dot" /> এখন online</small></div><button onClick={() => setOpen(false)}><X size={17} /></button></div><p>হ্যালো! ঠিক কী খুঁজছেন বুঝতে পারছেন না? সমস্যা নেই—একটু বলুন, মানুষই উত্তর দেবে।</p><a href="https://wa.me/8801700000000" target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp-এ কথা বলি</a><Link to="/customize" onClick={() => setOpen(false)}><PencilLine size={17} /> Custom brief পাঠাই</Link></div>}
      <button className="help-button" onClick={() => setOpen(!open)}>{open ? <X /> : <><MessageCircle /><span>একটু সাহায্য?</span><i /></>}</button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-main">
        <div className="footer-brand"><Logo light /><p>আপনার ভাবনাকে একটু যত্ন, একটু রঙ আর অনেকখানি মানুষের ছোঁয়ায় সত্যি করি।</p><div className="footer-socials"><a href="#" aria-label="Facebook"><span>f</span></a><a href="#" aria-label="Instagram"><span>◎</span></a><a href="#" aria-label="Youtube"><span>▶</span></a></div></div>
        <div className="footer-links"><div><h3>ঘুরে দেখুন</h3><Link to="/shop">সব পণ্য</Link><Link to="/shop?category=custom-wear">কাস্টম পোশাক</Link><Link to="/shop?category=print-press">প্রিন্ট ও প্রেস</Link><Link to="/shop?category=gifts">উপহার</Link></div><div><h3>সাহায্য</h3><a href="#">Delivery তথ্য</a><a href="#">Return ও replacement</a><a href="#">Size guide</a><a href="#">Order track</a></div><div><h3>BeeBazar</h3><a href="/#story">আমাদের গল্প</a><Link to="/customize">Bulk order</Link><a href="#">Privacy</a><a href="#">Terms</a></div></div>
        <div className="footer-contact"><h3>কথা বলতে চান?</h3><p>শনিবার–বৃহস্পতিবার<br />সকাল ১০টা–রাত ৯টা</p><a href="tel:+8801700000000"><Phone /> ০১৭০০ ০০০ ০০০</a><a href="mailto:hello@beebazar.com"><Mail /> hello@beebazar.com</a><span><MapPin /> ঢাকা, বাংলাদেশ</span></div>
      </div>
      <div className="shell footer-bottom"><span>© ২০২৬ BeeBazar. একটু বেশি যত্নে বানানো।</span><div><span>COD</span><span>bKash</span><span>VISA</span><span>Mastercard</span></div><a href="#top">উপরে যাই ↑</a></div>
    </footer>
  );
}

function NotFound() {
  return <main className="not-found"><div><span>404</span><h1>এই পথটা বোধহয়<br />মৌমাছিও খুঁজে পায়নি!</h1><p>চলুন, চেনা দোকানের পথে ফিরে যাই।</p><Link className="button button--honey" to="/">হোমে ফিরি <ArrowRight /></Link></div></main>;
}

function Layout() {
  const location = useLocation();
  const focusedCheckout = location.pathname.startsWith('/checkout');
  return (
    <div id="top">
      <ScrollToTop />
      {!focusedCheckout && <Header />}
      <Outlet />
      {!focusedCheckout && <Footer />}
      {!focusedCheckout && <CartDrawer />}
      {!focusedCheckout && <SearchOverlay />}
      {!focusedCheckout && <AccountModal />}
      {!focusedCheckout && <HelpBubble />}
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="customize" element={<CustomizePage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </StoreProvider>
  );
}
