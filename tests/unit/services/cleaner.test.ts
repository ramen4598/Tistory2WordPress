import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../../../src/models/Config';
import { loadConfig } from '../../../src/utils/config';
import { createCleaner } from '../../../src/services/cleaner';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('../../../src/utils/config');

const TMP_DIR = path.join(__dirname, '..', 'tmp');
const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

const dummyPost637Html = fs.readFileSync(
  path.join(__dirname, '..', 'helpers', 'post637.html'),
  'utf8'
);
const dummyPost634Html = fs.readFileSync(
  path.join(__dirname, '..', 'helpers', 'post634.html'),
  'utf8'
);
const dummyPost384Html = fs.readFileSync(
  path.join(__dirname, '..', 'helpers', 'post384.html'),
  'utf8'
);

describe('Cleaner service', () => {
  const metaTags = `
    <meta name="title" content="Test Post Title">
    <meta property="article:published_time" content="2024-01-15T10:00:00+09:00">
    <meta property="article:modified_time" content="2024-01-16T15:30:00+09:00">
  `;
  const categoryTags = `
    <div class="another_category">
      <h4><a href="/category/tech">Tech</a></h4>
    </div>
  `;
  const tagTags = `
    <div class="area_tag">
      <a href="/tag/javascript" rel="tag">JavaScript</a>
      <a href="/tag/typescript" rel="tag">TypeScript</a>
    </div>
  `;
  const contentWrapperStart = '<div class="tt_article_useless_p_margin contents_style">';
  const contentWrapperEnd = '</div>';

  beforeEach(() => {
    mockedLoadConfig.mockReturnValue({
      ...baseConfig,
      blogUrl: 'https://ramen4598.tistory.com',
    } as Config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR);
  }

  it('Just print out the cleaned HTML of post 637 for manual verification', async () => {
    const cleaner = createCleaner();
    const cleanedHtml = await cleaner.cleanHtml(dummyPost637Html);
    fs.writeFileSync(path.join(TMP_DIR, 'post637.cleaned.html'), cleanedHtml, 'utf8');
    console.log('Cleaned HTML of post 637 written to post637.cleaned.html');
  });

  it('Just print out the cleaned HTML of post 634 for manual verification', async () => {
    const cleaner = createCleaner();
    const cleanedHtml = await cleaner.cleanHtml(dummyPost634Html);
    fs.writeFileSync(path.join(TMP_DIR, 'post634.cleaned.html'), cleanedHtml, 'utf8');
    console.log('Cleaned HTML of post 634 written to post634.cleaned.html');
  });

  it('Just print out the cleaned HTML of post 384 for manual verification', async () => {
    const cleaner = createCleaner();
    const cleanedHtml = await cleaner.cleanHtml(dummyPost384Html);
    fs.writeFileSync(path.join(TMP_DIR, 'post384.cleaned.html'), cleanedHtml, 'utf8');
    console.log('Cleaned HTML of post 384 written to post384.cleaned.html');
  });

  it('should preserve table structure during cleaning', () => {
    const cleaner = createCleaner();
    const content = `
      <table class="table" style="width:100%; border-collapse: collapse;" border="1" data-ke-align="alignLeft">
        <tr>
          <th style="width: 50%;">Header 1</th>
          <th style="width: 50%;">Header 2</th>
        </tr>
        <tr>
          <td style="width: 50%;">Data 1</td>
          <td style="width: 50%;">Data 2</td>
        </tr>
      </table>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    expect(cleanedHtml).not.toContain('data-ke-align=');
    expect(cleanedHtml).not.toContain('style=');
    expect(cleanedHtml).not.toContain('border=');
    expect(cleanedHtml).toContain('<table>');
    expect(cleanedHtml).toContain('<thead>');
    expect(cleanedHtml).toContain('<tbody>');
    expect(cleanedHtml).toContain('<th>');
    expect(cleanedHtml).toContain('<tr>');
    expect(cleanedHtml).toContain('<th>Header 1</th>');
    expect(cleanedHtml).toContain('<th>Header 2</th>');
    expect(cleanedHtml).toContain('<td>Data 1</td>');
    expect(cleanedHtml).toContain('<td>Data 2</td>');
  });

  it('should preserve bold, strong, and italic formatting during cleaning', () => {
    const cleaner = createCleaner();
    const content = `
      <p>This is <strong>strong text</strong>, this is <b>bold text</b>, and this is <em>italic text</em>.</p>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    expect(cleanedHtml).toContain('<strong>strong text</strong>');
    expect(cleanedHtml).toContain('<strong>bold text</strong>');
    expect(cleanedHtml).toContain('<em>italic text</em>');
  });

  it('should preserve superscript and subscript formatting during cleaning', () => {
    const cleaner = createCleaner();
    const content = `
      <p>This is <sup>superscript</sup> and this is <sub>subscript</sub>.</p>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    expect(cleanedHtml).toContain('<sup>superscript</sup>');
    expect(cleanedHtml).toContain('<sub>subscript</sub>');
  });

  it('should preserve bookmark-card figure structure during cleaning', () => {
    const cleaner = createCleaner();
    const content = `
      <figure class="bookmark-card">
        <div class="bookmark-card-inner">
          <a class="bookmark-card-link" href="https://example.com" target="_blank" rel="noopener noreferrer">
            <div class="bookmark-card-content">
              <div class="bookmark-card-text">
                <div class="bookmark-card-title">Example Title</div>
                <div class="bookmark-card-description">Example description</div>
                <div class="bookmark-card-url">https://example.com</div>
              </div>
              <div class="bookmark-card-thumbnail">
                <img src="https://example.com/image.jpg" alt="Example Title" />
              </div>
            </div>
          </a>
        </div>
      </figure>
    `;

    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;

    const cleanedHtml = cleaner.cleanHtml(html);

    expect(cleanedHtml).toContain('<figure class="bookmark-card">');
    expect(cleanedHtml).toContain('<a class="bookmark-card-link" href="https://example.com"');
    expect(cleanedHtml).toContain('<div class="bookmark-card-title">Example Title</div>');
    expect(cleanedHtml).toContain(
      '<div class="bookmark-card-description">Example description</div>'
    );
    expect(cleanedHtml).toContain('<div class="bookmark-card-url">https://example.com</div>');
    expect(cleanedHtml).toContain('<img src="https://example.com/image.jpg" alt="Example Title">');
  });

  it('should preserve blockquotes during cleaning', () => {
    const cleaner = createCleaner();
    const content = `
      <blockquote>
        <p>This is a blockquote.</p>
      </blockquote>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    expect(cleanedHtml).toContain('<blockquote>');
    expect(cleanedHtml).toContain('<p>This is a blockquote.</p>');
  });

  it('should preserve YouTube iframes during cleaning', () => {
    const cleaner = createCleaner();
    const content = `
      <figure
        data-ke-type="video"
        data-ke-style="alignLeft"
        data-video-host="youtube"
        data-video-url="https://www.youtube.com/watch?v=ddZ-f_nuQ8k"
        data-video-thumbnail="https://blog.kakaocdn.net/dna/wiT5Z/hyZL1Q7FcY/AAAAAAAAAAAAAAAAAAAAAA5A2vLBp5FpTEf0-hZ38PH36lFG4vcDc3M-nIwL838y/img.jpg?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=ByC2CXcjaUhJxrtnRl4W05BhBos%3D"
        data-video-width="400"
        data-video-height="225"
        data-video-origin-width="860"
        data-video-origin-height="484"
        data-ke-mobilestyle="widthContent"
        data-video-title="Getting the most out of Proxmox Backup Server: Backing up other data, Offsite syncs, and more"
        data-original-url=""
        style="width: 400px;"
      >
        <div class="video-wrap">
          <iframe
            src="https://www.youtube.com/embed/example"
            width="400"
            height="225"
            frameborder=""
            allowfullscreen="true"
          ></iframe>
        </div>
        <figcaption style="display: none;"></figcaption>
      </figure>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    expect(cleanedHtml).not.toContain('data-ke-type=');
    expect(cleanedHtml).not.toContain('data-ke-style=');
    expect(cleanedHtml).not.toContain('data-video-host=');
    expect(cleanedHtml).not.toContain('data-video-url=');
    expect(cleanedHtml).not.toContain('data-video-thumbnail=');
    expect(cleanedHtml).not.toContain('data-video-width=');
    expect(cleanedHtml).not.toContain('data-video-height=');
    expect(cleanedHtml).not.toContain('data-video-origin-width=');
    expect(cleanedHtml).not.toContain('data-video-origin-height=');
    expect(cleanedHtml).not.toContain('data-ke-mobilestyle=');
    expect(cleanedHtml).not.toContain('data-video-title=');
    expect(cleanedHtml).not.toContain('data-original-url=');
    expect(cleanedHtml).not.toContain('style=');
    expect(cleanedHtml).toContain(
      '<iframe src="https://www.youtube.com/embed/example" width="400" height="225" allowfullscreen="true"></iframe>'
    );
  });

  it('should keep image tag in table (with multiple cells)', () => {
    const cleaner = createCleaner();
    const content = `
      <table style="border-collapse: collapse; width: 100%;" border="1" data-ke-align="alignLeft">
        <tbody>
          <tr>
            <td style="width: 50%;">
              <figure class="imageblock alignCenter" data-ke-mobilestyle="widthOrigin" data-origin-width="2438" data-origin-height="1640">
                <span
                  data-url="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D"
                  data-phocus="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D"
                >
                  <img
                    src="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D"
                    loading="lazy"
                    width="2438"
                    height="1640"
                    data-origin-width="2438"
                    data-origin-height="1640"
                  />
                </span>
              </figure>
            </td>
            <td style="width: 50%;">
              <figure class="imageblock alignCenter" data-ke-mobilestyle="widthOrigin" data-origin-width="2438" data-origin-height="1640">
                <span
                  data-url="https://blog.kakaocdn.net/dna/cA0Dvq/btssPwrfyzu/AAAAAAAAAAAAAAAAAAAAAOeMAhRvBHDIFBY0EMDBgPRI2MQtCI4k7cw-ywP37Mfp/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=ta8eEwBebfLEy0JM7kF%2FZClNwIs%3D"
                  data-phocus="https://blog.kakaocdn.net/dna/cA0Dvq/btssPwrfyzu/AAAAAAAAAAAAAAAAAAAAAOeMAhRvBHDIFBY0EMDBgPRI2MQtCI4k7cw-ywP37Mfp/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=ta8eEwBebfLEy0JM7kF%2FZClNwIs%3D"
                >
                  <img
                    src="https://blog.kakaocdn.net/dna/cA0Dvq/btssPwrfyzu/AAAAAAAAAAAAAAAAAAAAAOeMAhRvBHDIFBY0EMDBgPRI2MQtCI4k7cw-ywP37Mfp/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=ta8eEwBebfLEy0JM7kF%2FZClNwIs%3D"
                    loading="lazy"
                    width="2438"
                    height="1640"
                    data-origin-width="2438"
                    data-origin-height="1640"
                  />
                </span>
              </figure>
            </td>
          </tr>
        </tbody>
      </table>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    // 불필요한 속성들이 제거된지 확인한다.
    expect(cleanedHtml).not.toContain('data-ke-align=');
    expect(cleanedHtml).not.toContain('data-ke-mobilestyle=');
    expect(cleanedHtml).not.toContain('data-origin-width=');
    expect(cleanedHtml).not.toContain('data-origin-height=');
    expect(cleanedHtml).not.toContain('data-url=');
    expect(cleanedHtml).not.toContain('data-phocus=');
    expect(cleanedHtml).not.toContain('style=');
    expect(cleanedHtml).not.toContain('loading=');
    expect(cleanedHtml).not.toContain('<figure');
    expect(cleanedHtml).not.toContain('<span');

    // 우선은 테이블/이미지 구조가 통째로 보존되는지만 확인한다.
    expect(cleanedHtml).toContain('<table>');
    expect(cleanedHtml).toContain('<tbody>');
    expect(cleanedHtml).toContain('<tr>');
    expect(cleanedHtml).toContain('<td>');

    expect(cleanedHtml).toContain(
      '<img src="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&amp;expires=1767193199&amp;allow_ip=&amp;allow_referer=&amp;signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D" width="2438" height="1640">'
    );
    expect(cleanedHtml).toContain(
      '<img src="https://blog.kakaocdn.net/dna/cA0Dvq/btssPwrfyzu/AAAAAAAAAAAAAAAAAAAAAOeMAhRvBHDIFBY0EMDBgPRI2MQtCI4k7cw-ywP37Mfp/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&amp;expires=1767193199&amp;allow_ip=&amp;allow_referer=&amp;signature=ta8eEwBebfLEy0JM7kF%2FZClNwIs%3D" width="2438" height="1640">'
    );
  });

  it('should keep image tag in table (only one cell has image)', () => {
    const cleaner = createCleaner();
    const content = `
      <table style="border-collapse: collapse; width: 100%;" border="1" data-ke-align="alignLeft">
        <tbody>
          <tr>
            <td style="width: 50%;">
              <figure class="imageblock alignCenter" data-ke-mobilestyle="widthOrigin" data-origin-width="2438" data-origin-height="1640">
                <span
                  data-url="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D"
                  data-phocus="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D"
                >
                  <img
                    src="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D"
                    loading="lazy"
                    width="2438"
                    height="1640"
                    data-origin-width="2438"
                    data-origin-height="1640"
                  />
                </span>
              </figure>
            </td>
            <td style="width: 50%;">
              Some text content in the second cell.
            </td>
          </tr>
        </tbody>
      </table>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    // 불필요한 속성들이 제거된지 확인한다.
    expect(cleanedHtml).not.toContain('data-ke-align=');
    expect(cleanedHtml).not.toContain('data-ke-mobilestyle=');
    expect(cleanedHtml).not.toContain('data-origin-width=');
    expect(cleanedHtml).not.toContain('data-origin-height=');
    expect(cleanedHtml).not.toContain('data-url=');
    expect(cleanedHtml).not.toContain('data-phocus=');
    expect(cleanedHtml).not.toContain('style=');
    expect(cleanedHtml).not.toContain('loading=');
    expect(cleanedHtml).not.toContain('<figure');
    expect(cleanedHtml).not.toContain('<span');

    // 우선은 테이블/이미지 구조가 통째로 보존되는지만 확인한다.
    expect(cleanedHtml).toContain('<table>');
    expect(cleanedHtml).toContain('<tbody>');
    expect(cleanedHtml).toContain('<tr>');
    expect(cleanedHtml).toContain('<td>');

    expect(cleanedHtml).toContain(
      '<img src="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&amp;expires=1767193199&amp;allow_ip=&amp;allow_referer=&amp;signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D" width="2438" height="1640">'
    );
    expect(cleanedHtml).toContain('<td>Some text content in the second cell.</td>');
  });

  it('should keep image tag in table (with table header)', () => {
    const cleaner = createCleaner();
    const content = `
      <table style="border-collapse: collapse; width: 100%;" border="1" data-ke-align="alignLeft">
        <thead>
          <tr>
            <th style="width: 50%;">Header 1</th>
            <th style="width: 50%;">Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="width: 50%;">
              <figure class="imageblock alignCenter" data-ke-mobilestyle="widthOrigin" data-origin-width="2438" data-origin-height="1640">
                <span
                  data-url="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D"
                  data-phocus="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D"
                >
                  <img
                    src="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D"
                    loading="lazy"
                    width="2438"
                    height="1640"
                    data-origin-width="2438"
                    data-origin-height="1640"
                  />
                </span>
              </figure>
            </td>
            <td style="width: 50%;">
              <figure class="imageblock alignCenter" data-ke-mobilestyle="widthOrigin" data-origin-width="2438" data-origin-height="1640">
                <span
                  data-url="https://blog.kakaocdn.net/dna/cA0Dvq/btssPwrfyzu/AAAAAAAAAAAAAAAAAAAAAOeMAhRvBHDIFBY0EMDBgPRI2MQtCI4k7cw-ywP37Mfp/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=ta8eEwBebfLEy0JM7kF%2FZClNwIs%3D"
                  data-phocus="https://blog.kakaocdn.net/dna/cA0Dvq/btssPwrfyzu/AAAAAAAAAAAAAAAAAAAAAOeMAhRvBHDIFBY0EMDBgPRI2MQtCI4k7cw-ywP37Mfp/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=ta8eEwBebfLEy0JM7kF%2FZClNwIs%3D"
                >
                  <img
                    src="https://blog.kakaocdn.net/dna/cA0Dvq/btssPwrfyzu/AAAAAAAAAAAAAAAAAAAAAOeMAhRvBHDIFBY0EMDBgPRI2MQtCI4k7cw-ywP37Mfp/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=ta8eEwBebfLEy0JM7kF%2FZClNwIs%3D"
                    loading="lazy"
                    width="2438"
                    height="1640"
                    data-origin-width="2438"
                    data-origin-height="1640"
                  />
                </span>
              </figure>
            </td>
          </tr>
        </tbody>
      </table>
    `;
    const html =
      metaTags + categoryTags + tagTags + contentWrapperStart + content + contentWrapperEnd;
    const cleanedHtml = cleaner.cleanHtml(html);

    // 불필요한 속성들이 제거된지 확인한다.
    expect(cleanedHtml).not.toContain('data-ke-align=');
    expect(cleanedHtml).not.toContain('data-ke-mobilestyle=');
    expect(cleanedHtml).not.toContain('data-origin-width=');
    expect(cleanedHtml).not.toContain('data-origin-height=');
    expect(cleanedHtml).not.toContain('data-url=');
    expect(cleanedHtml).not.toContain('data-phocus=');
    expect(cleanedHtml).not.toContain('style=');
    expect(cleanedHtml).not.toContain('loading=');
    expect(cleanedHtml).not.toContain('<figure');
    expect(cleanedHtml).not.toContain('<span');

    // 우선은 테이블/이미지 구조가 통째로 보존되는지만 확인한다.
    expect(cleanedHtml).toContain('<table>');
    expect(cleanedHtml).toContain('<thead>');
    expect(cleanedHtml).toContain('<tbody>');
    expect(cleanedHtml).toContain('<th>');
    expect(cleanedHtml).toContain('<tr>');
    expect(cleanedHtml).toContain('<td>');

    expect(cleanedHtml).toContain('<th>Header 1</th>');
    expect(cleanedHtml).toContain('<th>Header 2</th>');
    expect(cleanedHtml).toContain(
      '<img src="https://blog.kakaocdn.net/dna/ACtHu/btssUOYuIXf/AAAAAAAAAAAAAAAAAAAAAOyT88uPtEbyAToTj98ANe02cRxHsdh3tRq2OqhKHpi7/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&amp;expires=1767193199&amp;allow_ip=&amp;allow_referer=&amp;signature=5QWbTCCkWs1sl1uXeuK5wMFrUoo%3D" width="2438" height="1640">'
    );
    expect(cleanedHtml).toContain(
      '<img src="https://blog.kakaocdn.net/dna/cA0Dvq/btssPwrfyzu/AAAAAAAAAAAAAAAAAAAAAOeMAhRvBHDIFBY0EMDBgPRI2MQtCI4k7cw-ywP37Mfp/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&amp;expires=1767193199&amp;allow_ip=&amp;allow_referer=&amp;signature=ta8eEwBebfLEy0JM7kF%2FZClNwIs%3D" width="2438" height="1640">'
    );
  });
});
