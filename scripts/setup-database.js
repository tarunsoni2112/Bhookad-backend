const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration in .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  try {
    console.log('🔄 Setting up Bhookad database schema...')
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../database/user_profiles.sql')
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8')
    
    // Split SQL commands (basic splitting by semicolon)
    const sqlCommands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))
    
    console.log(`📝 Executing ${sqlCommands.length} SQL commands...`)
    
    // Execute each SQL command
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i]
      if (command.trim()) {
        try {
          console.log(`⏳ Executing command ${i + 1}/${sqlCommands.length}...`)
          const { error } = await supabase.rpc('exec_sql', { sql: command })
          
          if (error) {
            console.error(`❌ Error executing command ${i + 1}:`, error.message)
            // Continue with other commands
          } else {
            console.log(`✅ Command ${i + 1} executed successfully`)
          }
        } catch (err) {
          console.error(`❌ Error executing command ${i + 1}:`, err.message)
        }
      }
    }
    
    // Test the setup by checking if the table exists
    console.log('🔍 Verifying table creation...')
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count(*)')
      .limit(1)
    
    if (error) {
      console.error('❌ Table verification failed:', error.message)
      console.log('💡 You may need to run the SQL commands manually in Supabase dashboard')
    } else {
      console.log('✅ Database schema setup completed successfully!')
      console.log('📊 user_profiles table is ready')
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message)
    console.log('💡 Please run the SQL commands manually in your Supabase dashboard:')
    console.log('   1. Go to https://supabase.com/dashboard')
    console.log('   2. Select your project')
    console.log('   3. Go to SQL Editor')
    console.log('   4. Run the contents of database/user_profiles.sql')
  }
}

// Run the setup
setupDatabase()
