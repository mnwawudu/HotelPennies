import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import AdBanner from '../components/AdBanner';
import './BlogDetail.css';

function readingTime(html = '') {
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').length : 0;
  const mins = Math.max(1, Math.round(words / 220));
  return `${mins} min read`;
}

export default function BlogDetail() {
  const { id } = useParams();
  const [blog, setBlog] = useState(null);
  const [allBlogs, setAllBlogs] = useState([]);

  // --- auth gate for CTA buttons (user or vendor) ---
  const getUserToken = () =>
    typeof window !== 'undefined'
      ? localStorage.getItem('userToken') || sessionStorage.getItem('userToken')
      : null;
  const getVendorToken = () =>
    typeof window !== 'undefined'
      ? localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken')
      : null;

  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => {
    const compute = () => setIsSignedIn(!!(getUserToken() || getVendorToken()));
    compute();
    window.addEventListener('storage', compute);
    return () => window.removeEventListener('storage', compute);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [one, list] = await Promise.all([
          axios.get(`/api/blogs/${id}`),
          axios.get('/api/blogs'),
        ]);
        if (!mounted) return;
        setBlog(one.data);
        setAllBlogs(Array.isArray(list.data) ? list.data : []);
      } catch (e) {
        console.error('Failed to fetch blog:', e);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const meta = useMemo(() => {
    if (!blog) return null;
    const date = blog.createdAt ? new Date(blog.createdAt) : null;
    return {
      dateStr: date ? date.toLocaleDateString() : '',
      rtime: readingTime(blog.content),
      author: blog.author && String(blog.author).trim() ? blog.author.trim() : 'HotelPennies',
    };
  }, [blog]);

  const related = useMemo(() => {
    if (!blog) return [];
    return allBlogs
      .filter(b => String(b._id) !== String(blog._id))
      .slice(0, 6);
  }, [allBlogs, blog]);

  if (!blog) return <p>Loading...</p>;

  // Build initial(s) for avatar; show "Hp" for HotelPennies specifically
  const authorInitials = (() => {
    const a = meta.author;
    if (/^hotelpennies$/i.test(a)) return 'Hp';
    const parts = a.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  })();

  return (
    <>
      {/* Scoped CSS just for this page so you don’t need to edit BlogDetail.css now */}
      <style>{`
        .blog-container { max-width: 980px; margin: 0 auto; padding: 24px 16px 48px; }
        .blog-hero {
          position: relative; overflow: hidden; border-radius: 16px;
          box-shadow: 0 6px 18px rgba(0,0,0,.08); margin: 18px 0 28px;
        }
        .hero-img { width: 100%; height: clamp(260px, 46vw, 520px); object-fit: cover; display: block; }
        .hero-titlewrap {
          position: absolute; left: 0; right: 0; bottom: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.55) 70%, rgba(0,0,0,.75) 100%);
          color: #fff; padding: 24px;
        }
        .hero-title { margin: 0 0 6px; font-size: clamp(22px, 3.6vw, 34px); line-height: 1.25; font-weight: 800; }
        .hero-meta { font-size: 13px; opacity: .95; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .dot { opacity: .65; }
        .blog-layout {
          display: grid; gap: 28px;
          grid-template-columns: 1fr; 
        }
        @media (min-width: 960px) {
          .blog-layout { grid-template-columns: minmax(0,1fr) 320px; }
        }
        .blog-main { min-width: 0; }
        .blog-content {
          color: #1b1b1b; line-height: 1.75; font-size: 16px;
        }
        .blog-content h2, .blog-content h3 { color: #0a3d62; margin-top: 22px; }
        .blog-content img { max-width: 100%; height: auto; border-radius: 10px; }
        .author-card {
          display: grid; grid-template-columns: 54px 1fr; gap: 12px;
          align-items: center; margin: 22px 0 10px; padding: 12px;
          border: 1px solid #eef0f3; border-radius: 12px; background: #fafcfe;
        }
        .author-avatar {
          width: 54px; height: 54px; display: grid; place-items: center;
          border-radius: 999px; background: #0a3d62; color: #fff; font-weight: 800; letter-spacing: .5px;
        }
        .author-name { font-weight: 700; color: #0a3d62; }
        .aside { position: relative; }
        .aside-card {
          background: #fff; border: 1px solid #eef0f3; border-radius: 12px;
          box-shadow: 0 6px 16px rgba(0,0,0,.06); padding: 14px; margin-bottom: 18px;
        }
        .aside-title { margin: 4px 0 12px; font-size: 16px; font-weight: 800; color: #0a3d62; }
        .aside-list { display: grid; gap: 12px; }
        .mini {
          display: grid; grid-template-columns: 64px 1fr; gap: 10px; align-items: center;
        }
        .mini img {
          width: 64px; height: 48px; object-fit: cover; border-radius: 8px; border: 1px solid #eef0f3;
        }
        .mini a {
          font-weight: 600; color: #182433; text-decoration: none;
        }
        .mini a:hover { color: #0a3d62; text-decoration: underline; }
        .cta {
          display: grid; gap: 10px; padding: 12px; background: #0a3d6208; border-radius: 10px;
        }
        .navy-btn {
          background: #0a3d62; color: #fff; border: 0; border-radius: 8px;
          padding: 10px 12px; cursor: pointer; font-weight: 700;
        }
        .navy-btn:hover { filter: brightness(1.05); }
      `}</style>

      <Header />

      <div className="blog-container">
        <AdBanner placement="blogs" />

        {/* HERO */}
        <section className="blog-hero">
          {blog.image?.length ? (
            <img className="hero-img" src={blog.image[0]} alt={blog.title} />
          ) : (
            <div className="hero-img" style={{ background: '#eef3f6' }} />
          )}
          <div className="hero-titlewrap">
            <h1 className="hero-title">{blog.title}</h1>
            <div className="hero-meta">
              <span>{meta.dateStr}</span>
              <span className="dot">•</span>
              <span>{meta.rtime}</span>
              <span className="dot">•</span>
              <span>{meta.author}</span>
            </div>
          </div>
        </section>

        {/* 2-column */}
        <div className="blog-layout">
          {/* MAIN */}
          <main className="blog-main">
            {/* Author card */}
            <div className="author-card">
              <div className="author-avatar">{authorInitials}</div>
              <div>
                <div className="author-name">{meta.author}</div>
                <div style={{ fontSize: 12, color: '#6b7785' }}>We help travelers find and book stays across Nigeria.</div>
              </div>
            </div>

            {/* Content */}
            <article
              className="blog-content"
              dangerouslySetInnerHTML={{ __html: blog.content }}
            />

            <div style={{ height: 24 }} />
            <AdBanner placement="blogs" />
          </main>

          {/* ASIDE */}
          <aside className="aside">
            <div className="aside-card">
              <div className="aside-title">Related posts</div>
              <div className="aside-list">
                {related.map((b) => (
                  <div className="mini" key={b._id}>
                    {b.image?.[0] ? <img src={b.image[0]} alt={b.title} /> : <div style={{width:64,height:48,borderRadius:8,background:'#eef3f6'}} />}
                    <Link to={`/blog/${b._id}`} title={b.title}>
                      {b.title.length > 58 ? `${b.title.slice(0, 58)}…` : b.title}
                    </Link>
                  </div>
                ))}
                {!related.length && <div style={{ color: '#6b7785' }}>No related posts yet.</div>}
              </div>
            </div>

            <div className="aside-card">
              <div className="aside-title">Do more on HotelPennies</div>
              <div className="cta">
                {/* If not signed in: show both buttons and send "List Your Property" to /auth with a next param */}
                {!isSignedIn && (
                  <Link
                    to={`/auth?next=${encodeURIComponent('/list-your-property')}`}
                    className="navy-btn"
                    style={{ textAlign: 'center', display: 'block' }}
                  >
                    List Your Property
                  </Link>
                )}
                {/* Use the correct route for Partner page */}
                <Link
                  to="/partner-with-us"
                  className="navy-btn"
                  style={{ textAlign: 'center', display: 'block', background: '#113e5a' }}
                >
                  Partner With Us
                </Link>
              </div>
            </div>

            <AdBanner placement="blogs" />
          </aside>
        </div>
      </div>

      <MainFooter />
    </>
  );
}
