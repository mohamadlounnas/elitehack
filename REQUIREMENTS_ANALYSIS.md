# Requirements Analysis & Issues Found

## ✅ Strengths
- Clear status flow concept
- Well-defined phases
- Separation of concerns (machines in separate table)

## ⚠️ Issues & Weaknesses Found

### 1. **Status Flow Issues**
- **Missing status**: `machines_generated` mentioned but not in status enum
- **Transition triggers unclear**: Who/what decides when to move from DATA_COLLECTING → CREATING_PROCCES? Need explicit AI decision point
- **Error handling**: What if CREATING_PROCCES fails? No rollback/recovery
- **Typo**: "rpeviews" should be "review" or "retry_pending"

### 2. **Machine Research Step Issues**
- **Missing foreign key**: Machines table needs `project_id` to link to projects
- **Supplier data incomplete**: Mentions "fixed phone number" but where stored? Need supplier table or fields
- **Image generation unclear**: Who generates images? Based on appearance description? Need AI image generation endpoint
- **3D model storage**: File paths or URLs? Storage location?
- **Retry mechanism**: When does retry happen? Automatic after X time? Manual trigger?
- **Review status logic**: What triggers review? How to handle partial failures?

### 3. **Data Storage Issues**
- **File attachments**: Where stored? Database BLOB? File system? S3?
- **Large data fields**: `data_collecting_result` and `creating_procces_result` - should these be JSON? TEXT? Separate tables?
- **Timestamps missing**: Need created_at, updated_at for tracking
- **User association**: No user_id mentioned - single user system or multi-user?

### 4. **API & Integration Issues**
- **Meshy3D bypass**: "bypass but implement methods and trigger after 2s" - unclear, implement fake delay?
- **Gemini API**: Need conversation context management - store chat history?
- **Web search**: How? Google Custom Search API? SerpAPI? Scraping? (scraping is fragile)
- **Rate limiting**: No mention of API rate limits

### 5. **Frontend Issues**
- **
 updates**: Need WebSocket or polling strategy defined
- **File upload**: How to handle? Multipart form? Direct to server?
- **Progress indicators**: Need clear UX for each status phase
- **Error display**: How to show errors to user?

### 6. **Business Logic Issues**
- **"Check all machines completed"**: Where does this check happen? Scheduled job? On each machine completion?
- **Industry 5.0 standards**: Need guidelines/schema for what data to collect
- **Validation**: No validation rules mentioned for any fields

## 🔧 Recommended Fixes

1. **Add missing status**: `MACHINES_GENERATED` to enum
2. **Add explicit transition methods**: `completeDataCollection()`, `completeProcessCreation()`, etc.
3. **Add machines.project_id**: Foreign key relationship
4. **Add supplier fields to machines**: `supplier_name`, `supplier_contact`, `supplier_url`
5. **Add storage strategy**: Define where files/images/3D models stored
6. **Add chat history table**: Store conversation for context
7. **Add user system**: Even if single user, add user_id for future
8. **Add timestamps**: created_at, updated_at everywhere
9. **Define retry logic**: Automatic retry after X minutes, or manual trigger
10. **Add error tracking**: error_message field in machines table

## 📋 Clarifications Needed

1. Multi-user or single user system?
2. File storage location (local filesystem vs cloud)?
3. Web search implementation method?
4. Image generation method (DALL-E, Stable Diffusion, other)?
5. Retry mechanism (automatic vs manual)?
6. How to detect "enough data collected" in DATA_COLLECTING phase?

