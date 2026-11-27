create role backup_leitura with login bypassrls nocreatedb nocreaterole;

grant pg_read_all_data to backup_leitura;
